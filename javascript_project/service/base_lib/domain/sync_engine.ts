/**
 * ERA 历史同步、回滚与顺序重算的纯计算引擎。
 *
 * 输入包含完整消息、stat、metadata、MK seed 与连续处理状态；输出只描述最终 JSON
 * 和消息文本更新，不读取或写入 Tavern。候选实现的 Host IO 与通知顺序不在本模块内。
 */

import {
  applyMessageCommands,
  type EraCrudEditLog,
  type EraFunctionEditLog,
} from "./crud_engine.ts";
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

export type EraSyncReasonV1 =
  "history-changed" | "edited" | "swipe-regeneration" | "manual" | "api-write";

export interface EraActionsTakenV1 {
  readonly rollback: boolean;
  readonly apply: boolean;
  readonly resync: boolean;
  readonly api: boolean;
  readonly apiWrite: boolean;
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

function compactionMarkersOf(
  meta: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return isPlainRecord(meta[COMPACTION_META_KEY])
    ? cloneSnapshotValue(meta[COMPACTION_META_KEY])
    : {};
}

function metaWithCompactionMarkers(
  meta: Readonly<Record<string, unknown>>,
  markers: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result = cloneSnapshotValue(meta) as Record<string, unknown>;
  defineOwn(result, COMPACTION_META_KEY, cloneSnapshotValue(markers));
  return result;
}

function cloneMessages(messages: readonly EraMkMessageV1[]): EraMkMessageV1[] {
  return cloneSnapshotValue(messages) as EraMkMessageV1[];
}

const COMPACTION_META_KEY = "CompressedEraCommands";

/** Fresh global matcher per invocation: VibeFlow forbids sticky RegExp state. */
function eraCommandBlockPattern(): RegExp {
  return /<((?:Variable|Function)(?:Insert|Edit|Delete))>\s*[\s\S]*?<\/\1>\s*/giu;
}

function sameJson(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => sameJson(value, right[index]))
    );
  }
  if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && sameJson(left[key], right[key]),
    )
  );
}

/** A deterministic, browser/Node-stable marker hash; it is a skip hint, not integrity. */
function compactHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

function rootIsProtected(value: unknown): boolean {
  return (
    isPlainRecord(value) &&
    isPlainRecord(value.$meta) &&
    (value.$meta.necessary === "self" || value.$meta.necessary === "all")
  );
}

function serializableRootChanges(start: unknown, end: unknown): string | null {
  if (!isPlainRecord(start) || !isPlainRecord(end)) return null;
  const deletes: Record<string, null> = {};
  const inserts: Record<string, unknown> = {};
  const edits: Record<string, unknown> = {};
  const roots = new Set([...Object.keys(start), ...Object.keys(end)]);
  for (const root of [...roots].sort()) {
    if (root === "$meta" || sameJson(start[root], end[root])) continue;
    if (rootIsProtected(start[root]) || rootIsProtected(end[root])) return null;
    const existed = Object.prototype.hasOwnProperty.call(start, root);
    const remains = Object.prototype.hasOwnProperty.call(end, root);
    if (!remains) {
      deletes[root] = null;
      continue;
    }
    if (!existed) {
      inserts[root] = cloneSnapshotValue(end[root]);
      continue;
    }
    const oldValue = start[root];
    const newValue = end[root];
    if (
      typeof oldValue === "number" &&
      Number.isFinite(oldValue) &&
      typeof newValue === "number" &&
      Number.isFinite(newValue) &&
      /^[A-Za-z_][A-Za-z0-9_]*$/u.test(root)
    ) {
      const delta = newValue - oldValue;
      if (!Number.isFinite(delta)) return null;
      edits[root] = {
        $expr: delta === 0 ? `@${root}` : `@${root} + ${JSON.stringify(delta)}`,
      };
      continue;
    }
    // VariableInsert retains its established merge semantics, so replace a complex
    // root through an explicit delete+insert pair rather than guessing a patch.
    deletes[root] = null;
    inserts[root] = cloneSnapshotValue(newValue);
  }
  const blocks: string[] = [];
  if (Object.keys(deletes).length > 0) {
    blocks.push(
      `<VariableDelete>\n${JSON.stringify(deletes)}\n</VariableDelete>`,
    );
  }
  if (Object.keys(inserts).length > 0) {
    blocks.push(
      `<VariableInsert>\n${JSON.stringify(inserts)}\n</VariableInsert>`,
    );
  }
  if (Object.keys(edits).length > 0) {
    blocks.push(`<VariableEdit>\n${JSON.stringify(edits)}\n</VariableEdit>`);
  }
  return blocks.join("\n");
}

function serializableFunctionChanges(
  start: Readonly<Record<string, unknown>>,
  end: Readonly<Record<string, unknown>>,
): string {
  const deletes: Record<string, Record<string, never>> = {};
  const inserts: Record<string, unknown> = {};
  const edits: Record<string, unknown> = {};
  const names = new Set([...Object.keys(start), ...Object.keys(end)]);
  for (const name of [...names].sort()) {
    if (sameJson(start[name], end[name])) continue;
    const existed = Object.prototype.hasOwnProperty.call(start, name);
    const remains = Object.prototype.hasOwnProperty.call(end, name);
    if (!remains) deletes[name] = {};
    else if (!existed) inserts[name] = cloneSnapshotValue(end[name]);
    else edits[name] = cloneSnapshotValue(end[name]);
  }
  const blocks: string[] = [];
  // Creating new definitions before editing existing definitions is the least
  // disruptive order for forward references. A replay proof below remains the
  // authority: mutually dependent ordering that cannot be preserved simply is
  // deliberately left uncompressed.
  if (Object.keys(inserts).length > 0)
    blocks.push(
      `<FunctionInsert>\n${JSON.stringify(inserts)}\n</FunctionInsert>`,
    );
  if (Object.keys(edits).length > 0)
    blocks.push(`<FunctionEdit>\n${JSON.stringify(edits)}\n</FunctionEdit>`);
  if (Object.keys(deletes).length > 0)
    blocks.push(
      `<FunctionDelete>\n${JSON.stringify(deletes)}\n</FunctionDelete>`,
    );
  return blocks.join("\n");
}

export interface EraSealedMessageCompactionV1 {
  readonly message: EraMkMessageV1;
  readonly content: string;
  readonly editLog: readonly EraCrudEditLog[];
  readonly functionEditLog: readonly EraFunctionEditLog[];
  readonly marker: Readonly<Record<string, unknown>>;
}

/**
 * Compress one sealed text assistant message. It never trusts algebra alone:
 * the generated candidate is replayed through the same six-command CRUD engine
 * from the exact layer snapshot, and is accepted only when state, function
 * library and diagnostics are observationally identical.
 */
export function compactSealedMessageCommands(
  message: EraMkMessageV1,
  mk: string,
  startStat: unknown,
  startFunctions: Readonly<Record<string, unknown>>,
  endStat: unknown,
  endFunctions: Readonly<Record<string, unknown>>,
  meta: Readonly<Record<string, unknown>>,
  traditionalToSimplified = false,
): EraSealedMessageCompactionV1 | null {
  if (message.role !== "assistant" || message.content.kind !== "text")
    return null;
  const original = message.content.text;
  if (!eraCommandBlockPattern().test(original)) return null;
  const compactVariables = serializableRootChanges(startStat, endStat);
  if (compactVariables === null) return null;
  const compactFunctions = serializableFunctionChanges(
    startFunctions,
    endFunctions,
  );
  const compactCommands = [compactVariables, compactFunctions]
    .filter(Boolean)
    .join("\n");
  const withoutCommands = original
    .replace(eraCommandBlockPattern(), "")
    .trimEnd();
  const content = `${withoutCommands}${compactCommands ? `\n${compactCommands}` : ""}\n`;
  const replay = applyMessageCommands({
    content,
    messageId: message.messageId,
    initialStat: startStat,
    initialStatFunc: startFunctions,
    meta,
    traditionalToSimplified,
  });
  if (
    replay.diagnostics.length > 0 ||
    !sameJson(replay.finalStat, endStat) ||
    !sameJson(replay.finalStatFunc ?? {}, endFunctions)
  )
    return null;
  return {
    message: { ...message, content: { kind: "text", text: content } },
    content,
    editLog: cloneSnapshotValue(replay.editLog),
    functionEditLog: cloneSnapshotValue(replay.functionEditLog ?? []),
    marker: {
      version: 1,
      mk,
      sourceHash: compactHash(original),
      compressedHash: compactHash(content),
    },
  };
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
    apiWrite: reason === "api-write",
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
  const markers = compactionMarkersOf(meta);
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
    if (!eraCommandBlockPattern().test(content)) continue;
    const mk = readMessageKey(message);
    const marker = mk === null ? null : markers[mk];
    const compacted =
      isPlainRecord(marker) && marker.compressedHash === compactHash(content);
    if (!compacted) return index;
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
    return {
      type: "FULL_RECALC",
      recalcId: messages.length > 0 ? messages.length - 1 : 0,
      cause: "no-divergence",
    };
  }
  const deleted = difference(oldSelectedMks, current);
  const added = difference(current, oldSelectedMks);
  if (
    added.length === 0 &&
    deleted.length > 0 &&
    editLogsAreEmpty(deleted, initialMeta)
  ) {
    return {
      type: "FAST_SYNC",
      firstMismatch,
      newSelectedMks: cloneSnapshotValue(current),
    };
  }
  return {
    type: "FULL_RECALC",
    recalcId: firstMismatch,
    cause: "divergence",
  };
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
    return {
      kind: "sync",
      status: "no-op",
      committed: false,
      divergence: null,
      stat: cloneSnapshotValue(input.stat),
      statFunc: cloneSnapshotValue(input.statFunc ?? {}) as Record<
        string,
        unknown
      >,
      meta: cloneSnapshotValue(input.meta),
      messages: [],
      messageUpdates: [],
      recalculatedMessageIndexes: [],
      rollback: { applied: false, fromMk: null, toMk: null },
      actionsTaken: createSyncActionsTaken(input.reason, false),
      consecutiveProcessingCount: null,
      nextConsecutiveState: cloneSnapshotValue(input.consecutiveState),
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
  const compactionMarkers = compactionMarkersOf(input.meta);
  const messageUpdates: EraSyncMessageUpdateV1[] = [];
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

    const contextMeta = metaWithCompactionMarkers(
      metaWith(
        input.meta,
        newSelectedMks.slice(0, index),
        editLogs,
        functionEditLogs,
      ),
      compactionMarkers,
    );
    const layerStartStat = cloneSnapshotValue(statForRecalc);
    const layerStartFunctions = cloneSnapshotValue(statFuncForRecalc) as Record<
      string,
      unknown
    >;
    const applied = applyMessageCommands({
      content: readMkMessageText(ensured.message),
      messageId: ensured.message.messageId,
      initialStat: layerStartStat,
      initialStatFunc: layerStartFunctions,
      meta: contextMeta,
      traditionalToSimplified: input.traditionalToSimplified,
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
    let effectiveEditLog = cloneSnapshotValue(applied.editLog);
    let effectiveFunctionEditLog = cloneSnapshotValue(
      applied.functionEditLog ?? [],
    );
    // An assistant floor becomes immutable only after a later assistant message
    // exists. The last floor stays verbatim so streaming/API writers can finish
    // their command sequence before it is ever canonicalised.
    const hasLaterAssistant = messages
      .slice(index + 1)
      .some((item) => item.role === "assistant");
    const storedMarker = compactionMarkers[ensured.mk];
    const alreadyCompacted =
      isPlainRecord(storedMarker) &&
      storedMarker.compressedHash ===
        compactHash(readMkMessageText(ensured.message));
    if (
      hasLaterAssistant &&
      applied.diagnostics.length === 0 &&
      !alreadyCompacted
    ) {
      const compacted = compactSealedMessageCommands(
        ensured.message,
        ensured.mk,
        layerStartStat,
        layerStartFunctions,
        applied.finalStat,
        applied.finalStatFunc ?? layerStartFunctions,
        contextMeta,
        input.traditionalToSimplified ?? false,
      );
      if (compacted !== null) {
        messages[index] = compacted.message;
        effectiveEditLog = cloneSnapshotValue(compacted.editLog);
        effectiveFunctionEditLog = cloneSnapshotValue(
          compacted.functionEditLog,
        );
        defineOwn(compactionMarkers, ensured.mk, compacted.marker);
        const update = {
          kind: "update-message-content" as const,
          messageId: compacted.message.messageId,
          messageIndex: index,
          mk: ensured.mk,
          content: cloneSnapshotValue(compacted.message.content),
        };
        const prior = messageUpdates.findIndex(
          (candidate) => candidate.messageId === update.messageId,
        );
        if (prior === -1) messageUpdates.push(update);
        else messageUpdates[prior] = update;
      }
    }
    defineOwn(editLogs, ensured.mk, effectiveEditLog);
    defineOwn(functionEditLogs, ensured.mk, effectiveFunctionEditLog);
    newSelectedMks[index] = ensured.mk;
    recalculatedMessageIndexes.push(index);
  }

  const finalMeta = metaWithCompactionMarkers(
    metaWith(input.meta, newSelectedMks, editLogs, functionEditLogs),
    compactionMarkers,
  );
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
