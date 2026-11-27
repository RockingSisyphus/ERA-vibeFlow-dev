/** Prepare a sync plan without host I/O. */
import { hasAppliedBlockRecords } from "../commands/message_function_calls.ts";
import { readMessageKey,readMkMessageText } from "../mk_engine.ts";
import { cloneSnapshotValue,rollbackStatToMK } from "../../snapshot/snapshot_history.ts";
import {
advanceConsecutiveMkState,
cloneMessages,
createSyncActionsTaken,
editLogsOf,
failedPlan,
functionEditLogsOf,metaWith,
rollbackFunctionsToMK,
selectedMksOf,
} from "./sync_divergence.ts";
import { findSyncDivergence } from "./sync_divergence_detection.ts";
import type { EraSyncDivergenceV1,EraSyncInputV1,EraSyncPlanV1 } from "./sync_types.ts";

function lastAppliedMkBefore(
  selectedMks: readonly (string | null)[],
  end: number,
): string | null {
  for (let index = end - 1; index >= 0; index -= 1) {
    const mk = selectedMks[index];
    if (mk !== null) return mk;
  }
  return null;
}

export function prepareEraSync(input: EraSyncInputV1): EraSyncPlanV1 {
  if (input.messages.length === 0) {
    const emptyMeta = metaWith(input.meta, [], {}, {});
    return {
      kind: "sync",
      status: "recalculated",
      committed: true,
      divergence: null,
      stat: {},
      statFunc: {},
      meta: emptyMeta,
      messages: [],
      messageUpdates: [],
      sealedCompactionCandidates: [],
      recalculatedMessageIndexes: [],
      rollback: { applied: false, fromMk: null, toMk: null },
      actionsTaken: createSyncActionsTaken(input.reason, true),
      consecutiveProcessingCount: null,
      nextConsecutiveState: null,
      diagnostics: [],
    };
  }

  const consecutive = advanceConsecutiveMkState(
    input.consecutiveState,
    input.processingMk,
  );
  const oldSelectedMks = selectedMksOf(input.meta);
  let divergence: EraSyncDivergenceV1;
  if (input.targetMessageId !== undefined) {
    if (
      !Number.isSafeInteger(input.targetMessageId) ||
      input.targetMessageId < 0 ||
      input.targetMessageId >= input.messages.length
    ) {
      return failedPlan(
        input,
        null,
        consecutive,
        "ERA_SYNC_TARGET_INVALID",
        "定向同步消息 ID 超出当前消息范围。",
      );
    }
    divergence = {
      type: "FULL_RECALC",
      // 新目标可能在尚未处理的用户楼层之后，从已有历史的末尾开始补算。
      recalcId: Math.min(input.targetMessageId, oldSelectedMks.length),
      cause: "targeted",
    };
  } else {
    divergence = findSyncDivergence(
      input.messages,
      oldSelectedMks,
      input.meta,
      input.forceFullRebuild,
    );
  }

  if (divergence.type === "FAST_SYNC") {
    const meta = metaWith(
      input.meta,
      divergence.newSelectedMks,
      editLogsOf(input.meta),
      functionEditLogsOf(input.meta),
    );
    return {
      kind: "sync",
      status: "fast-sync",
      committed: true,
      divergence,
      stat: cloneSnapshotValue(input.stat),
      statFunc: cloneSnapshotValue(input.statFunc ?? {}) as Record<
        string,
        unknown
      >,
      meta,
      messages: cloneMessages(input.messages),
      messageUpdates: [],
      sealedCompactionCandidates: [],
      recalculatedMessageIndexes: [],
      rollback: { applied: false, fromMk: null, toMk: null },
      actionsTaken: createSyncActionsTaken(input.reason, true),
      consecutiveProcessingCount: consecutive.count,
      nextConsecutiveState: consecutive.state,
      diagnostics: [],
    };
  }

  const firstRecalcId = divergence.recalcId;
  let statForRecalc = cloneSnapshotValue(input.stat);
  let statFuncForRecalc = cloneSnapshotValue(input.statFunc ?? {}) as Record<
    string,
    unknown
  >;
  let rollbackApplied = false;
  let rollbackFromMk: string | null = null;
  let rollbackToMk: string | null = null;
  try {
    // 旧版本可能已写累计日志却未把中断楼层登记到 SelectedMks；有完整日志时仍能撤回。
    for (const message of [...input.messages].reverse()) {
      const mk = readMessageKey(message);
      if (
        mk === null ||
        oldSelectedMks.includes(mk) ||
        !hasAppliedBlockRecords(readMkMessageText(message))
      )
        continue;
      if (
        !Object.hasOwn(editLogsOf(input.meta), mk) ||
        !Object.hasOwn(functionEditLogsOf(input.meta), mk)
      )
        continue;
      statForRecalc = rollbackStatToMK(
        null,
        mk,
        statForRecalc,
        [mk],
        editLogsOf(input.meta),
      );
      statFuncForRecalc = rollbackFunctionsToMK(
        null,
        mk,
        statFuncForRecalc,
        [mk],
        functionEditLogsOf(input.meta),
      );
    }
    if (firstRecalcId > -1 && firstRecalcId < oldSelectedMks.length) {
      // 回滚后单独切换较晚楼层的 Swipe 会留下空位。保留重算楼层之前
      // 最后一条已应用的记录，仅在此前完全没有记录时回到初始状态。
      const currentMk = lastAppliedMkBefore(oldSelectedMks, oldSelectedMks.length);
      const targetMk = lastAppliedMkBefore(oldSelectedMks, firstRecalcId);
      if (currentMk !== null && currentMk !== targetMk) {
        statForRecalc = rollbackStatToMK(
          targetMk,
          currentMk,
          statForRecalc,
          oldSelectedMks,
          editLogsOf(input.meta),
        );
        statFuncForRecalc = rollbackFunctionsToMK(
          targetMk,
          currentMk,
          statFuncForRecalc,
          oldSelectedMks,
          functionEditLogsOf(input.meta),
        );
        rollbackApplied = true;
        rollbackFromMk = currentMk;
        rollbackToMk = targetMk;
      }
    }
  } catch (error) {
    return failedPlan(
      input,
      divergence,
      consecutive,
      "ERA_SYNC_ROLLBACK_FAILED",
      error instanceof Error ? error.message : String(error),
    );
  }

  // 旧中间产物缺少累计回退日志时无法确定楼层起点，交回恢复入口。
  for (const message of input.messages) {
    const text = readMkMessageText(message);
    const mk = readMessageKey(message);
    if (
      hasAppliedBlockRecords(text) &&
      (mk === null ||
        !Object.hasOwn(editLogsOf(input.meta), mk) ||
        !Object.hasOwn(functionEditLogsOf(input.meta), mk))
    ) {
      return failedPlan(
        input,
        divergence,
        consecutive,
        "ERA_SYNC_PROGRESS_UNRECOVERABLE",
        "中断楼层缺少完整累计日志，无法确定其起点状态。",
      );
    }
  }
  return {
    kind: "sync",
    status: "recalculated",
    committed: true,
    divergence,
    stat: statForRecalc,
    statFunc: statFuncForRecalc,
    meta: metaWith(
      input.meta,
      oldSelectedMks.slice(0, firstRecalcId),
      editLogsOf(input.meta),
      functionEditLogsOf(input.meta),
    ),
    messages: cloneMessages(input.messages),
    messageUpdates: [],
    sealedCompactionCandidates: [],
    recalculatedMessageIndexes: [],
    rollback: {
      applied: rollbackApplied,
      fromMk: rollbackFromMk,
      toMk: rollbackToMk,
    },
    actionsTaken: createSyncActionsTaken(input.reason, true),
    consecutiveProcessingCount: consecutive.count,
    nextConsecutiveState: consecutive.state,
    diagnostics: [],
    execution: {
      messageIndex: firstRecalcId,
      endIndex: input.stopAtTarget
        ? (input.targetMessageId ?? firstRecalcId) + 1
        : input.messages.length,
      blockIndex: 0,
      randomDrawOffset: 0,
      floorStarted: false,
      layerStartStat: statForRecalc,
      layerStartStatFunc: statFuncForRecalc,
      mkSeedsByIndex: input.mkSeedsByIndex ?? [],
      traditionalToSimplified: input.traditionalToSimplified ?? false,
    },
  };
}

/** 可序列化的计算缓存；持久化权威是提交后的状态、累计日志和消息进度。 */
