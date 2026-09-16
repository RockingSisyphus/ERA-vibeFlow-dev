/**
 * ERA 历史同步、回滚与顺序重算的纯计算引擎。
 *
 * 输入包含完整消息、stat、metadata、MK seed 与连续处理状态；输出只描述最终 JSON
 * 和消息文本更新，不读取或写入 Tavern。候选实现的 Host IO 与通知顺序不在本模块内。
 */

import { applyMessageCommands } from "./crud_engine.ts";
import {
  parseMessageBlocks,
  type EraFunctionCallSite,
  hasAppliedBlockRecords,
  unwrapAppliedRecords,
  wrapBlockAsAppliedRecord,
} from "./message_function_calls.ts";
import {
  ensureMessageKey,
  messageContentVersion,
  readMessageKey,
  readMkMessageText,
  type EraMkContentV1,
  type EraMkMessageV1,
  type EraMkSeedV1,
} from "./mk_engine.ts";
import {
  cloneSnapshotValue,
  parseEditLog,
  rollbackStatToMK,
} from "./snapshot_query.ts";
import {
  commandCompactionMarkerIsCurrent,
  commandCompactionMarkersOf,
} from "./command_compaction_marker.ts";

export type EraSyncReasonV1 =
  | "history-changed"
  | "edited"
  | "swipe-regeneration"
  | "manual"
  | "facade-commit";

export interface EraActionsTakenV1 {
  readonly rollback: boolean;
  readonly apply: boolean;
  readonly resync: boolean;
  readonly api: boolean;
  readonly editedResync: boolean;
  readonly swipedRollback: boolean;
}

export interface EraConsecutiveMkStateV1 {
  readonly mk: string | null;
  readonly count: number;
}

export interface EraSyncInputV1 {
  readonly messages: readonly EraMkMessageV1[];
  readonly stat: unknown;
  /** Sidecar V3 function library. Chat variables never carry this state. */
  readonly statFunc?: Readonly<Record<string, unknown>>;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly reason: EraSyncReasonV1;
  readonly forceFullRebuild?: boolean;
  readonly targetMessageId?: number;
  readonly stopAtTarget?: boolean;
  readonly traditionalToSimplified?: boolean;
  readonly mkSeedsByIndex?: readonly (EraMkSeedV1 | null)[];
  readonly processingMk: string | null;
  readonly consecutiveState: EraConsecutiveMkStateV1 | null;
}

export type EraSyncDivergenceV1 =
  | {
      readonly type: "FAST_SYNC";
      readonly firstMismatch: number;
      readonly newSelectedMks: readonly (string | null)[];
    }
  | {
      readonly type: "FULL_RECALC";
      readonly recalcId: number;
      readonly cause: "forced" | "targeted" | "no-divergence" | "divergence";
    };

export interface EraSyncMessageUpdateV1 {
  readonly kind: "update-message-content";
  readonly messageId: number;
  readonly messageIndex: number;
  readonly mk: string;
  readonly content: EraMkContentV1;
}

export interface EraSyncDiagnosticV1 {
  readonly code: string;
  readonly message: string;
  readonly messageIndex: number | null;
  readonly path?: string;
}

/** A sealed assistant layer eligible for the pure command-compaction Nodeset. */
export interface EraSealedCompactionCandidateV1 {
  readonly messageId: number;
  readonly messageIndex: number;
  readonly mk: string;
  readonly layerStartStat: unknown;
  readonly layerStartStatFunc: Readonly<Record<string, unknown>>;
  readonly layerEndStat: unknown;
  readonly layerEndStatFunc: Readonly<Record<string, unknown>>;
  readonly eraMeta: Readonly<Record<string, unknown>>;
  readonly traditionalToSimplified: boolean;
}

export type EraSyncPlanV1 =
  | {
      readonly kind: "sync";
      readonly status: "no-op" | "fast-sync" | "recalculated";
      readonly committed: boolean;
      readonly divergence: EraSyncDivergenceV1 | null;
      readonly stat: unknown;
      readonly statFunc: Readonly<Record<string, unknown>>;
      readonly meta: Readonly<Record<string, unknown>>;
      readonly messages: readonly EraMkMessageV1[];
      readonly messageUpdates: readonly EraSyncMessageUpdateV1[];
      /** Internal pure-workflow hand-off; never itself becomes persistent state. */
      readonly sealedCompactionCandidates: readonly EraSealedCompactionCandidateV1[];
      readonly recalculatedMessageIndexes: readonly number[];
      /**
       * 每条被重算楼层的**起步世界**：引擎回退掉旧分支之后的 stat/statFunc。
       *
       * 为什么必须暴露它：块步进循环要一条楼层一条楼场地累计状态，而「侧车里已提交的状态」
       * 可能还含有这条楼层**旧版本**的效果（换 swipe / 重新生成 / 编辑）。从已提交状态起步，
       * 新版本的 `insert` 会被「键已存在」挡掉，提交出去的仍是旧分支（真机 UI-SWIPE-001 实测）。
       */
      readonly execution?: EraSyncExecutionV1 | null;
      readonly rollback: {
        readonly applied: boolean;
        readonly fromMk: string | null;
        readonly toMk: string | null;
      };
      readonly actionsTaken: EraActionsTakenV1;
      readonly consecutiveProcessingCount: number | null;
      readonly nextConsecutiveState: EraConsecutiveMkStateV1 | null;
      readonly diagnostics: readonly EraSyncDiagnosticV1[];
    }
  | {
      readonly kind: "sync";
      readonly status: "failed";
      readonly committed: false;
      readonly divergence: EraSyncDivergenceV1 | null;
      readonly stat: unknown;
      readonly statFunc: Readonly<Record<string, unknown>>;
      readonly meta: Readonly<Record<string, unknown>>;
      readonly messages: readonly EraMkMessageV1[];
      readonly messageUpdates: readonly [];
      readonly sealedCompactionCandidates: readonly [];
      readonly recalculatedMessageIndexes: readonly [];
      readonly rollback: {
        readonly applied: false;
        readonly fromMk: null;
        readonly toMk: null;
      };
      readonly actionsTaken: EraActionsTakenV1;
      readonly consecutiveProcessingCount: number;
      readonly nextConsecutiveState: EraConsecutiveMkStateV1;
      readonly diagnostics: readonly EraSyncDiagnosticV1[];
      readonly error: {
        readonly code: string;
        readonly message: string;
      };
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function defineOwn(
  target: Record<string, unknown> | unknown[],
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function selectedMksOf(
  meta: Readonly<Record<string, unknown>>,
): (string | null)[] {
  const selected = meta.SelectedMks;
  if (!Array.isArray(selected)) return [];
  const result = new Array<string | null>(selected.length);
  for (let index = 0; index < selected.length; index += 1) {
    if (!(index in selected)) {
      result[index] = null;
      continue;
    }
    const mk = selected[index];
    result[index] = typeof mk === "string" ? mk : null;
  }
  return result;
}

function editLogsOf(
  meta: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return isPlainRecord(meta.EditLogs) ? cloneSnapshotValue(meta.EditLogs) : {};
}

function functionEditLogsOf(
  meta: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return isPlainRecord(meta.FunctionEditLogs)
    ? cloneSnapshotValue(meta.FunctionEditLogs)
    : {};
}

function metaWith(
  source: Readonly<Record<string, unknown>>,
  selectedMks: readonly (string | null)[],
  editLogs: Readonly<Record<string, unknown>>,
  functionEditLogs: Readonly<Record<string, unknown>> = functionEditLogsOf(
    source,
  ),
): Record<string, unknown> {
  const result = cloneSnapshotValue(source) as Record<string, unknown>;
  defineOwn(result, "SelectedMks", cloneSnapshotValue(selectedMks));
  defineOwn(result, "EditLogs", cloneSnapshotValue(editLogs));
  defineOwn(result, "FunctionEditLogs", cloneSnapshotValue(functionEditLogs));
  return result;
}

function cloneMessages(messages: readonly EraMkMessageV1[]): EraMkMessageV1[] {
  return cloneSnapshotValue(messages) as EraMkMessageV1[];
}

/** Reverse the function logs for the same MK interval as variable rollback. */
function rollbackFunctionsToMK(
  targetMK: string | null,
  currentMK: string,
  currentFunctions: Readonly<Record<string, unknown>>,
  selectedMks: readonly (string | null)[],
  allLogs: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const currentIndex = selectedMks.indexOf(currentMK);
  const targetIndex = targetMK ? selectedMks.indexOf(targetMK) : -1;
  if (currentIndex < 0 || (targetMK !== null && targetIndex < 0)) {
    throw new Error("函数历史缺少回滚所需的 MK。");
  }
  const temporary = cloneSnapshotValue(currentFunctions) as Record<
    string,
    unknown
  >;
  for (let index = currentIndex; index > targetIndex; index -= 1) {
    const mk = selectedMks[index];
    if (!mk) continue;
    const log = parseEditLog(allLogs[mk]);
    for (let entryIndex = log.length - 1; entryIndex >= 0; entryIndex -= 1) {
      const entry = log[entryIndex];
      if (
        !isPlainRecord(entry) ||
        typeof entry.name !== "string" ||
        !entry.name
      )
        continue;
      const op = String(entry.op ?? "").toLowerCase();
      if (op === "insert") {
        delete temporary[entry.name];
      } else if (op === "update" || op === "delete") {
        if (Object.prototype.hasOwnProperty.call(entry, "value_old")) {
          defineOwn(temporary, entry.name, cloneSnapshotValue(entry.value_old));
        } else {
          delete temporary[entry.name];
        }
      }
    }
  }
  return temporary;
}

/** 生成候选 dispatcher 的七项动作标记；resync 仅在同步成功后置 true。 */
export function createSyncActionsTaken(
  reason: EraSyncReasonV1,
  resync = false,
): EraActionsTakenV1 {
  return {
    rollback: false,
    apply: false,
    resync,
    api: false,
    editedResync: reason === "edited",
    swipedRollback: reason === "swipe-regeneration",
  };
}

/** 复刻 dispatcher 的 truthy MK 连续计数；空 MK 每次重置为 1。 */
export function advanceConsecutiveMkState(
  previous: EraConsecutiveMkStateV1 | null,
  mk: string | null,
): {
  readonly state: EraConsecutiveMkStateV1;
  readonly count: number;
} {
  const state =
    mk && previous?.mk === mk
      ? { mk, count: previous.count + 1 }
      : { mk, count: 1 };
  return { state: cloneSnapshotValue(state), count: state.count };
}

/** 读取当前消息列表的有效 MK 链；缺失或损坏 MK 显式为 null。 */
export function currentSelectedMks(
  messages: readonly EraMkMessageV1[],
): readonly (string | null)[] {
  return messages.map((message) => readMessageKey(message));
}

function difference(
  values: readonly (string | null)[],
  exclusions: readonly (string | null)[],
): (string | null)[] {
  return values.filter((value) => !exclusions.includes(value));
}

function editLogsAreEmpty(
  mks: readonly (string | null)[],
  meta: Readonly<Record<string, unknown>>,
): boolean {
  const logs = editLogsOf(meta);
  const functionLogs = functionEditLogsOf(meta);
  for (const mk of mks) {
    if (!mk) continue;
    if (
      parseEditLog(logs[mk]).length > 0 ||
      parseEditLog(functionLogs[mk]).length > 0
    )
      return false;
  }
  return true;
}

/**
 * 新的 assistant 楼层会使前面的 assistant 楼层封存。增量追加本身通常只重算
 * 新楼层，因此这里显式找出最早仍需 canonicalise 的已封存指令楼层；否则历史
 * 压缩器只会在手动 full sync、编辑或 swipe 后偶然运行。
 */
function firstUncompactedSealedAssistant(
  messages: readonly EraMkMessageV1[],
  meta: Readonly<Record<string, unknown>>,
): number | null {
  const markers = commandCompactionMarkersOf(meta);
  for (let index = 0; index < messages.length - 1; index += 1) {
    const message = messages[index];
    if (message.role !== "assistant" || message.content.kind !== "text")
      continue;
    if (
      !messages
        .slice(index + 1)
        .some((candidate) => candidate.role === "assistant")
    )
      continue;
    const content = readMkMessageText(message);
    if (
      !/<((?:Variable|Function)(?:Insert|Edit|Delete))>\s*[\s\S]*?<\/\1>/iu.test(
        content,
      )
    )
      continue;
    const mk = readMessageKey(message);
    const marker = mk === null ? null : markers[mk];
    const selectedPrefix = messages
      .slice(0, index)
      .map((candidate) => readMessageKey(candidate));
    if (
      mk === null ||
      !commandCompactionMarkerIsCurrent(marker, mk, content, selectedPrefix)
    )
      return index;
  }
  return null;
}

/**
 * 把重算起点收紧到「最早带已应用记录的楼层」。
 *
 * 只在记录楼层更靠前时才改变结论：它更靠后时常规分歧点已经覆盖它，不需要动。
 */
function tightenToAppliedRecords(
  divergence: EraSyncDivergenceV1,
  messages: readonly EraMkMessageV1[],
): EraSyncDivergenceV1 {
  const recordFloor = firstAppliedRecordFloor(messages);
  if (recordFloor === null) return divergence;
  if (divergence.type === "FULL_RECALC" && divergence.recalcId <= recordFloor) {
    return divergence;
  }
  return { type: "FULL_RECALC", recalcId: recordFloor, cause: "divergence" };
}

/**
 * 最早带有「已应用」记录（逐块提交的进度凭据）的楼层下标。
 *
 * 这类楼层是被中断的：sidecar 里的 stat 停在它算到一半的位置，因此**必须**从它开始重算，
 * 否则「中断楼层 + 之后又来了新楼层」会让它永远算不完（常规分歧点落在它后面）。
 */
function firstAppliedRecordFloor(
  messages: readonly EraMkMessageV1[],
): number | null {
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message === undefined || message.content.kind !== "text") continue;
    if (hasAppliedBlockRecords(message.content.text)) return index;
  }
  return null;
}

/**
 * 比较 current/old SelectedMks，并保留候选唯一 fast path：只删除且被删 MK
 * 的 EditLog 全部为空。
 */
export function findSyncDivergence(
  messages: readonly EraMkMessageV1[],
  oldSelectedMks: readonly (string | null)[],
  initialMeta: Readonly<Record<string, unknown>>,
  forceFullRebuild = false,
): EraSyncDivergenceV1 {
  if (forceFullRebuild) {
    return { type: "FULL_RECALC", recalcId: 0, cause: "forced" };
  }
  const versions = initialMeta.MessageContentVersions;
  if (Array.isArray(versions)) {
    const changed = messages.findIndex(
      (message, index) =>
        index < versions.length &&
        versions[index] !== messageContentVersion(readMkMessageText(message)),
    );
    if (changed >= 0)
      return { type: "FULL_RECALC", recalcId: changed, cause: "divergence" };
  }
  const current = currentSelectedMks(messages);
  const minimum = Math.min(current.length, oldSelectedMks.length);
  let firstMismatch = -1;
  for (let index = 0; index < minimum; index += 1) {
    if (current[index] !== oldSelectedMks[index]) {
      firstMismatch = index;
      break;
    }
  }
  if (firstMismatch === -1 && current.length !== oldSelectedMks.length) {
    firstMismatch = minimum;
  }
  // Appending a new assistant makes a previous assistant floor immutable. Re-open
  // only the earliest uncompressed sealed interval so that real chat traffic,
  // rather than a later manual full sync, performs the promised compaction.
  if (firstMismatch === minimum && current.length > oldSelectedMks.length) {
    const sealedIndex = firstUncompactedSealedAssistant(messages, initialMeta);
    if (sealedIndex !== null && sealedIndex < firstMismatch) {
      return {
        type: "FULL_RECALC",
        recalcId: sealedIndex,
        cause: "divergence",
      };
    }
  }
  if (firstMismatch === -1) {
    return tightenToAppliedRecords(
      {
        type: "FULL_RECALC",
        recalcId: messages.length > 0 ? messages.length - 1 : 0,
        cause: "no-divergence",
      },
      messages,
    );
  }
  const deleted = difference(oldSelectedMks, current);
  const added = difference(current, oldSelectedMks);
  if (
    added.length === 0 &&
    deleted.length > 0 &&
    editLogsAreEmpty(deleted, initialMeta)
  ) {
    return tightenToAppliedRecords(
      {
        type: "FAST_SYNC",
        firstMismatch,
        newSelectedMks: cloneSnapshotValue(current),
      },
      messages,
    );
  }
  return tightenToAppliedRecords(
    {
      type: "FULL_RECALC",
      recalcId: firstMismatch,
      cause: "divergence",
    },
    messages,
  );
}

function failedPlan(
  input: EraSyncInputV1,
  divergence: EraSyncDivergenceV1 | null,
  consecutive: {
    readonly state: EraConsecutiveMkStateV1;
    readonly count: number;
  },
  code: string,
  message: string,
): EraSyncPlanV1 {
  return {
    kind: "sync",
    status: "failed",
    committed: false,
    divergence,
    stat: cloneSnapshotValue(input.stat),
    statFunc: cloneSnapshotValue(input.statFunc ?? {}) as Record<
      string,
      unknown
    >,
    meta: cloneSnapshotValue(input.meta),
    messages: cloneMessages(input.messages),
    messageUpdates: [],
    sealedCompactionCandidates: [],
    recalculatedMessageIndexes: [],
    rollback: { applied: false, fromMk: null, toMk: null },
    actionsTaken: createSyncActionsTaken(input.reason, false),
    consecutiveProcessingCount: consecutive.count,
    nextConsecutiveState: consecutive.state,
    diagnostics: [{ code, message, messageIndex: null }],
    error: { code, message },
  };
}

/** 定位历史分歧并撤销旧效果，建立尚未应用命令的逐块执行状态。 */
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
      // A new target can follow unprocessed user floors. Keep the applied
      // prefix contiguous so a later rollback cannot mistake a hole for
      // the beginning of history.
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
      const currentMk = oldSelectedMks[oldSelectedMks.length - 1];
      const targetMk =
        firstRecalcId > 0 ? oldSelectedMks[firstRecalcId - 1] : null;
      if (currentMk) {
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
export interface EraSyncExecutionV1 {
  readonly messageIndex: number;
  readonly endIndex: number;
  readonly blockIndex: number;
  readonly randomDrawOffset: number;
  readonly floorStarted: boolean;
  readonly layerStartStat: unknown;
  readonly layerStartStatFunc: Readonly<Record<string, unknown>>;
  readonly mkSeedsByIndex: readonly (EraMkSeedV1 | null)[];
  readonly traditionalToSimplified: boolean;
}

export interface EraSyncBlockResultV1 {
  readonly pendingCall?: EraFunctionCallSite;
  readonly plan: EraSyncPlanV1;
  readonly done: boolean;
  readonly failure: { readonly code: string; readonly message: string } | null;
  readonly messageIndex: number | null;
}

/** 正式推进和纯历史计算共用的单块语义；正式入口只多记录文本进度。 */
export function advanceEraSyncBlock(
  plan: EraSyncPlanV1,
  formal = true,
  suspendCalls = false,
  pauseBeforeBlock = false,
): EraSyncBlockResultV1 {
  if (plan.status === "failed" || !plan.execution)
    return { plan, done: true, failure: null, messageIndex: null };
  let execution = plan.execution;
  const index = execution.messageIndex;
  if (index >= execution.endIndex)
    return {
      plan: { ...plan, execution: null },
      done: true,
      failure: null,
      messageIndex: null,
    };
  const messages = cloneMessages(plan.messages);
  const ensured = ensureMessageKey(
    messages[index],
    execution.mkSeedsByIndex[index] ?? undefined,
  );
  if ("reason" in ensured) {
    const selected = selectedMksOf(plan.meta).slice();
    selected[index] = null;
    execution = {
      ...execution,
      messageIndex: index + 1,
      blockIndex: 0,
      floorStarted: false,
    };
    const done = execution.messageIndex >= execution.endIndex;
    return {
      plan: {
        ...plan,
        meta: metaWith(
          plan.meta,
          selected,
          editLogsOf(plan.meta),
          functionEditLogsOf(plan.meta),
        ),
        messageUpdates: plan.messageUpdates,
        sealedCompactionCandidates: [],
        diagnostics: [
          ...plan.diagnostics,
          {
            code:
              ensured.status === "seed-required"
                ? "ERA_SYNC_MK_SEED_REQUIRED"
                : "ERA_SYNC_MESSAGE_INVALID",
            message: ensured.reason,
            messageIndex: index,
          },
        ],
        execution: done ? null : execution,
      },
      done,
      failure: null,
      messageIndex: index,
    };
  }
  let text = readMkMessageText(ensured.message);
  const editLogs = editLogsOf(plan.meta);
  const functionEditLogs = functionEditLogsOf(plan.meta);
  const selected = selectedMksOf(plan.meta).slice();
  if (!execution.floorStarted) {
    // 已撤销旧效果后从原文重算；临时标记不能代替回退日志。
    text = unwrapAppliedRecords(text);
    execution = {
      ...execution,
      floorStarted: true,
      blockIndex: 0,
      randomDrawOffset: 0,
      layerStartStat: cloneSnapshotValue(plan.stat),
      layerStartStatFunc: cloneSnapshotValue(plan.statFunc),
    };
    defineOwn(editLogs, ensured.mk, []);
    defineOwn(functionEditLogs, ensured.mk, []);
  }
  // A stage may perform its JSON calls at this exact position. Establish the
  // same floor origin and random cursor without consuming the next text block.
  if (pauseBeforeBlock) {
    messages[index] = { ...ensured.message, content: { kind: "text", text } };
    return {
      plan: {
        ...plan,
        messages,
        execution,
        meta: metaWith(plan.meta, selected, editLogs, functionEditLogs),
      },
      done: false,
      failure: null,
      messageIndex: index,
    };
  }
  const blocks = parseMessageBlocks({
    content: text,
    traditionalToSimplified: execution.traditionalToSimplified,
  });
  const block = blocks[execution.blockIndex];
  if (
    block?.kind === "call" &&
    !block.call.nested &&
    !block.call.processed &&
    formal
  ) {
    if (suspendCalls) {
      messages[index] = { ...ensured.message, content: { kind: "text", text } };
      selected[index] = ensured.mk;
      return {
        plan: {
          ...plan,
          messages,
          execution,
          meta: metaWith(plan.meta, selected, editLogs, functionEditLogs),
        },
        done: false,
        messageIndex: index,
        failure: null,
        pendingCall: block.call,
      };
    }
    return {
      plan,
      done: true,
      messageIndex: index,
      failure: {
        code: "ERA_FCALL_NOT_IMPLEMENTED",
        message: `消息 #${ensured.message.messageId} 位置 ${block.start} 的 EraFCall ${block.call.name ?? "?"} 尚未实现。${block.call.diagnostics.map((d) => d.message).join(" ")}`,
      },
    };
  }
  let stat = plan.stat;
  let statFunc = plan.statFunc;
  const diagnostics = [...plan.diagnostics];
  if (block?.kind === "command") {
    const ordinal = blocks
      .slice(0, execution.blockIndex)
      .filter((b) => b.kind === "command").length;
    const applied = applyMessageCommands({
      content: text,
      messageId: ensured.message.messageId,
      initialStat: stat,
      initialStatFunc: statFunc,
      messageStartStat: execution.layerStartStat,
      messageStartStatFunc: execution.layerStartStatFunc,
      meta: metaWith(
        plan.meta,
        selected.slice(0, index),
        editLogs,
        functionEditLogs,
      ),
      randomSourceKey: ensured.mk,
      randomDrawOffset: execution.randomDrawOffset,
      commandRange: { fromIndex: ordinal, toIndex: ordinal + 1 },
      traditionalToSimplified: execution.traditionalToSimplified,
    });
    stat = applied.finalStat;
    statFunc = applied.finalStatFunc ?? statFunc;
    defineOwn(editLogs, ensured.mk, [
      ...parseEditLog(editLogs[ensured.mk]),
      ...applied.editLog,
    ]);
    defineOwn(functionEditLogs, ensured.mk, [
      ...parseEditLog(functionEditLogs[ensured.mk]),
      ...(applied.functionEditLog ?? []),
    ]);
    diagnostics.push(
      ...applied.diagnostics.map((d) => ({ ...d, messageIndex: index })),
    );
    execution = {
      ...execution,
      randomDrawOffset:
        applied.nextRandomDrawOffset ?? execution.randomDrawOffset,
    };
    if (formal)
      text = wrapBlockAsAppliedRecord({
        content: text,
        start: block.start,
        end: block.end,
        mk: ensured.mk,
        draws: execution.randomDrawOffset,
      });
  }
  if (formal && block?.kind === "call" && !block.call.nested) {
    text = wrapBlockAsAppliedRecord({
      content: text,
      start: block.start,
      end: block.end,
      mk: ensured.mk,
      draws: execution.randomDrawOffset,
    });
  }
  const floorDone = block === undefined;
  if (floorDone) text = unwrapAppliedRecords(text);
  messages[index] = { ...ensured.message, content: { kind: "text", text } };
  selected[index] = ensured.mk;
  const meta = metaWith(plan.meta, selected, editLogs, functionEditLogs);
  const candidates: EraSealedCompactionCandidateV1[] = [];
  if (
    floorDone &&
    messages.slice(index + 1).some((m) => m.role === "assistant") &&
    !diagnostics.some(
      (d) =>
        d.messageIndex === index &&
        !/^ERA_(?:FCALL|FUNCTION_CALL)_/u.test(d.code),
    ) &&
    !commandCompactionMarkerIsCurrent(
      commandCompactionMarkersOf(meta)[ensured.mk],
      ensured.mk,
      text,
      selected.slice(0, index),
    )
  ) {
    candidates.push({
      messageId: ensured.message.messageId,
      messageIndex: index,
      mk: ensured.mk,
      layerStartStat: execution.layerStartStat,
      layerStartStatFunc: execution.layerStartStatFunc,
      layerEndStat: stat,
      layerEndStatFunc: statFunc,
      eraMeta: metaWith(
        meta,
        selected.slice(0, index),
        editLogs,
        functionEditLogs,
      ),
      traditionalToSimplified: execution.traditionalToSimplified,
    });
  }
  execution = floorDone
    ? {
        ...execution,
        messageIndex: index + 1,
        blockIndex: 0,
        randomDrawOffset: 0,
        floorStarted: false,
      }
    : { ...execution, blockIndex: execution.blockIndex + 1 };
  const done = execution.messageIndex >= execution.endIndex;
  return {
    plan: {
      ...plan,
      stat,
      statFunc,
      meta,
      messages,
      diagnostics,
      messageUpdates: [
        ...plan.messageUpdates.filter(
          (update) => update.messageId !== ensured.message.messageId,
        ),
        {
          kind: "update-message-content",
          messageId: ensured.message.messageId,
          messageIndex: index,
          mk: ensured.mk,
          content: { kind: "text", text },
        },
      ],
      sealedCompactionCandidates: candidates,
      recalculatedMessageIndexes: floorDone
        ? [...plan.recalculatedMessageIndexes, index]
        : plan.recalculatedMessageIndexes,
      execution: done ? null : execution,
    },
    done,
    failure: null,
    messageIndex: index,
  };
}

/** 只读入口仅折叠同一块应用器，不写消息、不调用作者函数。 */
export function planEraSync(input: EraSyncInputV1): EraSyncPlanV1 {
  let plan = prepareEraSync(input);
  const updates: EraSyncMessageUpdateV1[] = [];
  const candidates: EraSealedCompactionCandidateV1[] = [];
  while (plan.status !== "failed" && plan.execution) {
    const step = advanceEraSyncBlock(plan, false);
    plan = step.plan;
    updates.push(...plan.messageUpdates);
    candidates.push(...plan.sealedCompactionCandidates);
  }
  if (plan.status === "failed") return plan;
  const byId = new Map(updates.map((u) => [u.messageId, u]));
  return {
    ...plan,
    messageUpdates: [...byId.values()].filter((update) => {
      const original = input.messages[update.messageIndex];
      return (
        original === undefined ||
        readMkMessageText(original) !==
          (update.content.kind === "text" ? update.content.text : "")
      );
    }),
    sealedCompactionCandidates: candidates,
  };
}
