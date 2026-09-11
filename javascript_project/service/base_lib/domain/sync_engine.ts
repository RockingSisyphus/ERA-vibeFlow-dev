/**
 * ERA 历史同步、回滚与顺序重算的纯计算引擎。
 *
 * 输入包含完整消息、stat、metadata、MK seed 与连续处理状态；输出只描述最终 JSON
 * 和消息文本更新，不读取或写入 Tavern。候选实现的 Host IO 与通知顺序不在本模块内。
 */

import {
  applyMessageCommands,
  type EraCrudDiagnostic,
  type EraCrudEditLog,
  type EraFunctionEditLog,
} from "./crud_engine.ts";
import {
  appliedCommandPrefix,
  appliedRecordDrawOffset,
  hasAppliedBlockRecords,
  startEraBlockSession,
  advanceEraBlockSession,
  type EraFunctionCallSite,
} from "./message_function_calls.ts";
import {
  ensureMessageKey,
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
  "history-changed" | "edited" | "swipe-regeneration" | "manual" | "facade-commit";

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
    if (!/<((?:Variable|Function)(?:Insert|Edit|Delete))>\s*[\s\S]*?<\/\1>/iu.test(content))
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
function firstAppliedRecordFloor(messages: readonly EraMkMessageV1[]): number | null {
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

/** 生成一次完整的声明式同步计划和候选等价最终 JSON。 */
export function planEraSync(input: EraSyncInputV1): EraSyncPlanV1 {
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
      recalcId: input.targetMessageId,
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
    if (firstRecalcId > -1 && firstRecalcId < oldSelectedMks.length) {
      const currentMk = oldSelectedMks[oldSelectedMks.length - 1];
      const targetMk =
        firstRecalcId > 0 ? oldSelectedMks[firstRecalcId - 1] : null;
      if (currentMk) {
        statForRecalc = rollbackStatToMK(
          targetMk,
          currentMk,
          input.stat,
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

  const messages = cloneMessages(input.messages);
  const newSelectedMks = oldSelectedMks.slice(0, firstRecalcId);
  const editLogs = editLogsOf(input.meta);
  const functionEditLogs = functionEditLogsOf(input.meta);
  const messageUpdates: EraSyncMessageUpdateV1[] = [];
  const sealedCompactionCandidates: EraSealedCompactionCandidateV1[] = [];
  const recalculatedMessageIndexes: number[] = [];
  const diagnostics: EraSyncDiagnosticV1[] = [];

  for (let index = firstRecalcId; index < messages.length; index += 1) {
    if (input.stopAtTarget && index > firstRecalcId) break;
    const ensured = ensureMessageKey(
      messages[index],
      input.mkSeedsByIndex?.[index] ?? undefined,
    );
    if ("reason" in ensured) {
      newSelectedMks[index] = null;
      diagnostics.push({
        code:
          ensured.status === "seed-required"
            ? "ERA_SYNC_MK_SEED_REQUIRED"
            : "ERA_SYNC_MESSAGE_INVALID",
        message: ensured.reason,
        messageIndex: index,
      });
      continue;
    }
    messages[index] = ensured.message;
    if (ensured.textUpdate !== null) {
      messageUpdates.push({
        ...ensured.textUpdate,
        messageIndex: index,
        mk: ensured.mk,
      });
    }

    const contextMeta = metaWith(
      input.meta,
      newSelectedMks.slice(0, index),
      editLogs,
      functionEditLogs,
    );
    const layerStartStat = cloneSnapshotValue(statForRecalc);
    const layerStartFunctions = cloneSnapshotValue(statFuncForRecalc) as Record<
      string,
      unknown
    >;
    const floorText = readMkMessageText(ensured.message);
    // 这条楼层若还留着「已应用」记录，说明它是被中断的：已提交的块构成指令序列的前缀，
    // 重放必须从该前缀之后开始（sidecar 的 stat 已经包含它们）。同一条记录也要求下面的
    // EditLogs **追加**而不是覆盖，否则回退会漏掉已提交块的日志。
    const appliedPrefix = appliedCommandPrefix({ content: floorText });
    const interrupted = hasAppliedBlockRecords(floorText);
    const applied = applyMessageCommands({
      content: floorText,
      messageId: ensured.message.messageId,
      initialStat: layerStartStat,
      initialStatFunc: layerStartFunctions,
      randomSourceKey: ensured.mk,
      meta: contextMeta,
      traditionalToSimplified: input.traditionalToSimplified,
      ...(appliedPrefix > 0
        ? {
            commandRange: {
              fromIndex: appliedPrefix,
              toIndex: Number.MAX_SAFE_INTEGER,
            },
            // 抽取序列必须接着已提交块继续，否则续做与整楼重放的随机值不同、终值不等价。
            randomDrawOffset: appliedRecordDrawOffset(floorText),
          }
        : {}),
    });
    statForRecalc = applied.finalStat;
    statFuncForRecalc = cloneSnapshotValue(
      applied.finalStatFunc ?? statFuncForRecalc,
    ) as Record<string, unknown>;
    diagnostics.push(
      ...applied.diagnostics.map((diagnostic) => ({
        code: diagnostic.code,
        message: diagnostic.message,
        messageIndex: index,
        path: diagnostic.path,
      })),
    );
    const alreadyLogged = parseEditLog(editLogs[ensured.mk]);
    const effectiveEditLog = interrupted
      ? [...alreadyLogged, ...cloneSnapshotValue(applied.editLog)]
      : cloneSnapshotValue(applied.editLog);
    const alreadyLoggedFunctions = parseEditLog(
      functionEditLogs[ensured.mk],
    ) as readonly EraFunctionEditLog[];
    const effectiveFunctionEditLog = interrupted
      ? [
          ...alreadyLoggedFunctions,
          ...cloneSnapshotValue(applied.functionEditLog ?? []),
        ]
      : cloneSnapshotValue(applied.functionEditLog ?? []);
    // An assistant floor becomes immutable only after a later assistant message
    // exists. The last floor stays verbatim so streaming/API writers can finish
    // their command sequence before it is ever canonicalised.
    const hasLaterAssistant = messages
      .slice(index + 1)
      .some((item) => item.role === "assistant");
    if (
      hasLaterAssistant &&
      applied.diagnostics.length === 0 &&
      !commandCompactionMarkerIsCurrent(
        commandCompactionMarkersOf(input.meta)[ensured.mk],
        ensured.mk,
        readMkMessageText(ensured.message),
        newSelectedMks.slice(0, index),
      )
    ) {
      sealedCompactionCandidates.push({
        messageId: ensured.message.messageId,
        messageIndex: index,
        mk: ensured.mk,
        layerStartStat: cloneSnapshotValue(layerStartStat),
        layerStartStatFunc: cloneSnapshotValue(layerStartFunctions) as Record<string, unknown>,
        layerEndStat: cloneSnapshotValue(applied.finalStat),
        layerEndStatFunc: cloneSnapshotValue(applied.finalStatFunc ?? layerStartFunctions) as Record<string, unknown>,
        eraMeta: cloneSnapshotValue(contextMeta) as Record<string, unknown>,
        traditionalToSimplified: input.traditionalToSimplified ?? false,
      });
    }
    defineOwn(editLogs, ensured.mk, effectiveEditLog);
    defineOwn(functionEditLogs, ensured.mk, effectiveFunctionEditLog);
    newSelectedMks[index] = ensured.mk;
    recalculatedMessageIndexes.push(index);
  }

  const finalMeta = metaWith(input.meta, newSelectedMks, editLogs, functionEditLogs);
  return {
    kind: "sync",
    status: "recalculated",
    committed: true,
    divergence,
    stat: cloneSnapshotValue(statForRecalc),
    statFunc: cloneSnapshotValue(statFuncForRecalc),
    meta: finalMeta,
    messages,
    messageUpdates,
    sealedCompactionCandidates,
    recalculatedMessageIndexes,
    rollback: {
      applied: rollbackApplied,
      fromMk: rollbackFromMk,
      toMk: rollbackToMk,
    },
    actionsTaken: createSyncActionsTaken(input.reason, true),
    consecutiveProcessingCount: consecutive.count,
    nextConsecutiveState: consecutive.state,
    diagnostics,
  };
}


/** 一步一块重放的可续做检查点：只保存续做所需的最小状态。 */
export interface EraMessageReplayCheckpoint {
  readonly messageIndex: number;
  readonly blockIndex: number;
  readonly stat: unknown;
  readonly statFunc: Readonly<Record<string, unknown>>;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly done?: boolean;
  /** 调用方已处理但文本尚未写回的调用标识。 */
  readonly resolvedCallIds?: readonly string[];
}

export interface EraMessageReplayBlockInput {
  readonly message: EraMkMessageV1;
  readonly messageIndex: number;
  readonly messageId: number;
  readonly mk: string;
  readonly checkpoint: EraMessageReplayCheckpoint;
  /** 正式同步为 true；只读与试算为 false。 */
  readonly formal?: boolean;
  readonly traditionalToSimplified?: boolean;
  /** 调用方已把上一次的调用写回文本时传 true，清除待调用后按标识跳过它。 */
  readonly resolvePendingCall?: boolean;
}

export interface EraMessageReplayBlockResult {
  readonly checkpoint: EraMessageReplayCheckpoint;
  readonly done: boolean;
  readonly executedBlockIndexes: readonly number[];
  readonly stat: unknown;
  readonly statFunc?: Readonly<Record<string, unknown>>;
  readonly editLog: readonly EraCrudEditLog[];
  readonly functionEditLog: readonly EraFunctionEditLog[];
  readonly pendingCall: EraFunctionCallSite | null;
  readonly diagnostics: readonly EraCrudDiagnostic[];
}

/**
 * 按块重放一条消息的一步。
 *
 * 与 `applyMessageCommands` 的重放使用同一套块解析与执行语义，区别只在于每次
 * 只推进一个块并把续做状态交回调用方，因此可以跨步骤、跨 FIFO 事件续做。
 */
export function replayMessageBlock(
  input: EraMessageReplayBlockInput,
): EraMessageReplayBlockResult {
  const session = startEraBlockSession({
    content: readMkMessageText(input.message),
    messageId: input.messageId,
    mk: input.mk,
    initialStat: input.checkpoint.stat,
    initialStatFunc: input.checkpoint.statFunc,
    meta: input.checkpoint.meta,
    randomSourceKey: input.mk,
    traditionalToSimplified: input.traditionalToSimplified ?? false,
    formal: input.formal ?? true,
    ...(input.checkpoint.resolvedCallIds === undefined
      ? {}
      : { resolvedCallIds: input.checkpoint.resolvedCallIds }),
    cursor: {
      messageId: input.messageId,
      mk: input.mk,
      blockIndex: input.checkpoint.blockIndex,
      done: input.checkpoint.done ?? false,
      randomDrawOffset: 0,
      editLog: [],
      functionEditLog: [],
    },
  });

  const advanced =
    input.resolvePendingCall === true
      ? advanceEraBlockSession(
          advanceEraBlockSession(session, { resolvePendingCall: true }),
          {},
        )
      : advanceEraBlockSession(session);

  return {
    checkpoint: {
      messageIndex: input.messageIndex,
      blockIndex: advanced.cursor.blockIndex,
      stat: advanced.stat,
      statFunc: advanced.statFunc ?? input.checkpoint.statFunc,
      meta: input.checkpoint.meta,
      done: advanced.done,
      resolvedCallIds: advanced.resolvedCallIds,
    },
    done: advanced.done,
    executedBlockIndexes: advanced.executedBlockIndexes,
    stat: advanced.stat,
    ...(advanced.statFunc === undefined ? {} : { statFunc: advanced.statFunc }),
    editLog: advanced.editLog,
    functionEditLog: advanced.functionEditLog,
    pendingCall: advanced.pendingCall,
    diagnostics: advanced.diagnostics,
  };
}
