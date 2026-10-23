/** Sync metadata, rollback and consecutive processing helpers. */
import { type EraMkMessageV1 } from "../mk_engine.ts";
import { cloneSnapshotValue,parseEditLog } from "../../snapshot/snapshot_history.ts";
import type { EraActionsTakenV1,EraConsecutiveMkStateV1,EraSyncDivergenceV1,EraSyncInputV1,EraSyncPlanV1,EraSyncReasonV1 } from "./sync_types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function defineOwn(
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

export function selectedMksOf(
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

export function editLogsOf(
  meta: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return isPlainRecord(meta.EditLogs) ? cloneSnapshotValue(meta.EditLogs) : {};
}

export function functionEditLogsOf(
  meta: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return isPlainRecord(meta.FunctionEditLogs)
    ? cloneSnapshotValue(meta.FunctionEditLogs)
    : {};
}

export function metaWith(
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

export function cloneMessages(messages: readonly EraMkMessageV1[]): EraMkMessageV1[] {
  return cloneSnapshotValue(messages) as EraMkMessageV1[];
}

/** Reverse the function logs for the same MK interval as variable rollback. */
export function rollbackFunctionsToMK(
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

/**
 * 新的 assistant 楼层会使前面的 assistant 楼层封存。增量追加本身通常只重算
 * 新楼层，因此这里显式找出最早仍需 canonicalise 的已封存指令楼层；否则历史
 * 压缩器只会在手动 full sync、编辑或 swipe 后偶然运行。
 */
export function failedPlan(
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
