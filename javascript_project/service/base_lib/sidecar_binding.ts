import { cloneEraPortableJsonV1 } from "@era/vibeflow-contracts";

/** Sidecar 的纯规则：聊天变量只提供身份指针；状态只来自 V3 用户文件。 */
export interface SyncContextV1 {
  readonly step: unknown;
  readonly variablesRaw: unknown;
  readonly messagesRaw: unknown;
  readonly [key: string]: unknown;
}

export type SidecarChoiceV1 = "migrate" | "independent" | "copy" | "repair";
export type SidecarBindingStatusV1 =
  | "create"
  | "migrate-legacy"
  | "matched"
  | "conflict"
  | "invalid"
  | "blocked";

export interface SidecarOwnerV1 {
  readonly characterId: string | null;
  readonly groupId: string | null;
  readonly chatId: string;
}

export interface SidecarStateV2 {
  readonly statData: unknown;
  readonly eraMeta: Record<string, unknown>;
  /** V3 adds the only durable function library; V2 data is migrated with `{}`. */
  readonly statFunc: Record<string, unknown>;
}

export interface SidecarRecordV1 {
  readonly schemaVersion: 3;
  readonly sidecarId: string;
  readonly owner: SidecarOwnerV1;
  readonly revision: number;
  readonly state: SidecarStateV2;
}

export interface LegacySidecarRecordV1 {
  readonly schemaVersion: 1 | 2;
  readonly sidecarId: string;
  readonly owner: SidecarOwnerV1;
  readonly revision: number;
  readonly statData: unknown;
  readonly eraMeta?: Record<string, unknown>;
}

export interface SidecarFactsV1 {
  readonly status: SidecarBindingStatusV1;
  readonly reason: string;
  readonly current: SidecarOwnerV1 | null;
  readonly sidecarId: string | null;
  readonly record: SidecarRecordV1 | null;
  readonly legacyRecord: LegacySidecarRecordV1 | null;
  readonly legacyState: SidecarStateV2 | null;
}

export interface SidecarResolutionV1 {
  readonly facts: SidecarFactsV1;
  readonly route: "continue" | "blocked" | "apply";
  readonly choice: SidecarChoiceV1 | null;
}

type EnrichedSyncContext = SyncContextV1 & {
  readonly sidecarBinding?: SidecarFactsV1;
  readonly sidecarBindingRoute?: "continue" | "blocked" | "applied";
  readonly sidecarBindingChoice?: SidecarChoiceV1 | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneSyncJson<T>(value: T): T {
  return cloneEraPortableJsonV1(value) as T;
}

function owner(value: unknown): SidecarOwnerV1 | null {
  if (!isRecord(value) || (typeof value.characterId !== "string" && value.characterId !== null) ||
    (typeof value.groupId !== "string" && value.groupId !== null) || typeof value.chatId !== "string" || value.chatId.length === 0) return null;
  return { characterId: value.characterId, groupId: value.groupId, chatId: value.chatId };
}

function sameOwner(left: SidecarOwnerV1, right: SidecarOwnerV1): boolean {
  return left.characterId === right.characterId && left.groupId === right.groupId && left.chatId === right.chatId;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && /^era_chat_[a-z0-9-]{8,80}$/iu.test(value);
}

function eraMetaWithoutPointer(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const result = cloneSyncJson(value);
  delete result.SidecarId;
  return result;
}

export function parseRecord(value: unknown, expectedId: string): SidecarRecordV1 | null {
  if (!isRecord(value) || value.schemaVersion !== 3 || value.sidecarId !== expectedId || typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 0) return null;
  const recordOwner = owner(value.owner);
  const state = value.state;
  if (recordOwner === null || !isRecord(state) || !Object.prototype.hasOwnProperty.call(state, "statData") || !isRecord(state.eraMeta) || !isRecord(state.statFunc)) return null;
  return {
    schemaVersion: 3,
    sidecarId: expectedId,
    owner: recordOwner,
    revision: value.revision,
    state: {
      statData: cloneSyncJson(state.statData),
      eraMeta: cloneSyncJson(state.eraMeta),
      statFunc: cloneSyncJson(state.statFunc),
    },
  };
}

function parseLegacyRecord(value: unknown, expectedId: string): LegacySidecarRecordV1 | null {
  if (!isRecord(value) || (value.schemaVersion !== 1 && value.schemaVersion !== 2) || value.sidecarId !== expectedId || typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 0) return null;
  const recordOwner = owner(value.owner);
  if (recordOwner === null) return null;
  if (value.schemaVersion === 1) {
    if (!Object.prototype.hasOwnProperty.call(value, "statData")) return null;
    return { schemaVersion: 1, sidecarId: expectedId, owner: recordOwner, revision: value.revision, statData: cloneSyncJson(value.statData) };
  }
  const state = value.state;
  if (!isRecord(state) || !Object.prototype.hasOwnProperty.call(state, "statData") || !isRecord(state.eraMeta)) return null;
  return {
    schemaVersion: 2,
    sidecarId: expectedId,
    owner: recordOwner,
    revision: value.revision,
    statData: cloneSyncJson(state.statData),
    eraMeta: cloneSyncJson(state.eraMeta),
  };
}

/** 聊天变量只承载可选 SidecarId 指针；运行资格由安装作用域 workflow 决定。 */
export function sidecarIdFromVariables(value: unknown): { readonly sidecarId: string | null } {
  if (!isRecord(value)) return { sidecarId: null };
  const meta = value.ERAMetaData;
  if (!isRecord(meta)) return { sidecarId: null };
  return { sidecarId: validId(meta.SidecarId) ? meta.SidecarId : null };
}

function stateFromCurrent(currentRaw: Record<string, unknown>): SidecarStateV2 | null {
  const meta = eraMetaWithoutPointer(currentRaw.meta);
  if (meta === null || !Object.prototype.hasOwnProperty.call(currentRaw, "stat") || currentRaw.stat === null) return null;
  return { statData: cloneSyncJson(currentRaw.stat), eraMeta: meta, statFunc: {} };
}

export function stateFromRecord(record: SidecarRecordV1): SidecarStateV2 {
  return {
    statData: cloneSyncJson(record.state.statData),
    eraMeta: cloneSyncJson(record.state.eraMeta),
    statFunc: cloneSyncJson(record.state.statFunc),
  };
}

/**
 * 复制变量创建的是一条新的聊天历史。变量和函数定义需要深拷贝，但旧聊天的
 * 回放索引属于原消息链，绝不能带入新聊天；否则后续 full sync 会把新聊天误判
 * 为已经处理过旧聊天的楼层。
 */
export function stateForIndependentCopy(record: SidecarRecordV1): SidecarStateV2 {
  const state = stateFromRecord(record);
  delete state.eraMeta.SelectedMks;
  delete state.eraMeta.EditLogs;
  delete state.eraMeta.FunctionEditLogs;
  delete state.eraMeta.CommandCompaction;
  return state;
}

export function variablesForState(state: SidecarStateV2, sidecarId: string): Record<string, unknown> {
  return {
    stat_data: cloneSyncJson(state.statData),
    statFunc: cloneSyncJson(state.statFunc),
    ERAMetaData: { ...cloneSyncJson(state.eraMeta), SidecarId: sidecarId },
  };
}

export function inspectSidecar(currentRaw: unknown, recordRaw: unknown): SidecarFactsV1 {
  if (!isRecord(currentRaw)) return { status: "invalid", reason: "current-context-invalid", current: null, sidecarId: null, record: null, legacyRecord: null, legacyState: null };
  const current = owner(currentRaw.identity);
  const identity = sidecarIdFromVariables({ ERAMetaData: currentRaw.meta });
  const legacyState = stateFromCurrent(currentRaw);
  if (current === null) return { status: "invalid", reason: "current-identity-invalid", current: null, sidecarId: identity.sidecarId, record: null, legacyRecord: null, legacyState };
  if (identity.sidecarId === null) return legacyState === null
    ? { status: "create", reason: "sidecar-id-absent", current, sidecarId: null, record: null, legacyRecord: null, legacyState: null }
    : { status: "migrate-legacy", reason: "sidecar-id-absent-with-legacy-state", current, sidecarId: null, record: null, legacyRecord: null, legacyState };
  const envelope = isRecord(recordRaw) ? recordRaw : {};
  if (envelope.status === "missing") return legacyState === null
    ? { status: "invalid", reason: "sidecar-record-missing", current, sidecarId: identity.sidecarId, record: null, legacyRecord: null, legacyState: null }
    : { status: "migrate-legacy", reason: "sidecar-record-missing-with-legacy-state", current, sidecarId: identity.sidecarId, record: null, legacyRecord: null, legacyState };
  const record = envelope.status === "found" ? parseRecord(envelope.record, identity.sidecarId) : null;
  if (record !== null) {
    if (legacyState !== null) return { status: "migrate-legacy", reason: "legacy-chat-state-present", current, sidecarId: identity.sidecarId, record, legacyRecord: null, legacyState };
    if (sameOwner(current, record.owner)) return { status: "matched", reason: "owner-matched", current, sidecarId: identity.sidecarId, record, legacyRecord: null, legacyState: null };
    return { status: "conflict", reason: "owner-mismatch", current, sidecarId: identity.sidecarId, record, legacyRecord: null, legacyState: null };
  }
  const legacyRecord = envelope.status === "found" ? parseLegacyRecord(envelope.record, identity.sidecarId) : null;
  if (legacyRecord !== null) return { status: "migrate-legacy", reason: "v1-record", current, sidecarId: identity.sidecarId, record: null, legacyRecord, legacyState };
  return { status: "invalid", reason: "sidecar-record-invalid", current, sidecarId: identity.sidecarId, record: null, legacyRecord: null, legacyState };
}

export function choiceFromSyncContext(context: SyncContextV1): SidecarChoiceV1 | null {
  const step = isRecord(context.step) ? context.step : null;
  const task = step !== null && step.kind === "execute" && isRecord(step.task) && step.task.kind === "sync" ? step.task : null;
  const primaryEvent = task !== null && isRecord(task.primaryEvent) ? task.primaryEvent : null;
  if (primaryEvent?.type !== "era.ui.sidecar_binding_choice") return null;
  const envelope = Array.isArray(primaryEvent.args) ? primaryEvent.args[0] : undefined;
  const first = isRecord(envelope) && envelope.kind === "json" && isRecord(envelope.value) ? envelope.value : null;
  if (first === null) return null;
  return first.choice === "migrate" || first.choice === "independent" || first.choice === "copy" || first.choice === "repair" ? first.choice : null;
}

export function enrich(context: SyncContextV1, facts: SidecarFactsV1, route: "continue" | "blocked" | "applied", choice: SidecarChoiceV1 | null = null): EnrichedSyncContext {
  const variablesRaw = facts.record !== null && facts.sidecarId !== null && (route === "continue" || route === "applied")
    ? variablesForState(stateFromRecord(facts.record), facts.sidecarId)
    : context.variablesRaw;
  return { ...context, variablesRaw, sidecarBinding: facts, sidecarBindingRoute: route, sidecarBindingChoice: choice };
}

export function resolveSidecar(facts: SidecarFactsV1, context: SyncContextV1): SidecarResolutionV1 {
  if (facts.status === "create" || facts.status === "migrate-legacy") return { facts, route: "apply", choice: null };
  const choice = choiceFromSyncContext(context);
  if (facts.status === "matched" && choice === "repair") return { facts, route: "apply", choice };
  if (facts.status === "matched") return { facts, route: "continue", choice: null };
  if (facts.status === "conflict" && (choice === "migrate" || choice === "independent" || choice === "copy")) return { facts, route: "apply", choice };
  if (facts.status === "invalid" && choice === "repair") return { facts, route: "apply", choice };
  return { facts, route: "blocked", choice: null };
}

export function recordFor(id: string, current: SidecarOwnerV1, state: SidecarStateV2 | unknown, previous: SidecarRecordV1 | LegacySidecarRecordV1 | null): SidecarRecordV1 {
  // Compatibility for old unit fixtures is deliberately one-way: any successful write emits V3.
  const normalized: SidecarStateV2 = isRecord(state) && Object.prototype.hasOwnProperty.call(state, "statData") && isRecord(state.eraMeta)
    ? {
        statData: cloneSyncJson(state.statData),
        eraMeta: cloneSyncJson(state.eraMeta),
        statFunc: isRecord(state.statFunc) ? cloneSyncJson(state.statFunc) : {},
      }
    : { statData: cloneSyncJson(state), eraMeta: {}, statFunc: {} };
  return { schemaVersion: 3, sidecarId: id, owner: current, revision: (previous?.revision ?? 0) + 1, state: normalized };
}

/** 将一次已提交的 V2 record 回填为后续纯同步所使用的唯一状态。 */
export function factsWithRecord(facts: SidecarFactsV1, record: SidecarRecordV1): SidecarFactsV1 {
  return {
    ...facts,
    status: "matched",
    reason: "sidecar-state-loaded",
    sidecarId: record.sidecarId,
    record,
    legacyRecord: null,
    legacyState: null,
  };
}

export function canPersist(result: unknown): boolean {
  return isRecord(result) && result.status === "committed" && result.variablesCommitted === true;
}

function protectedRootKeys(statData: unknown): readonly string[] | null {
  if (!isRecord(statData)) return null;
  const rootNecessary = isRecord(statData.$meta) ? statData.$meta.necessary : undefined;
  if (rootNecessary === "all") return ["<root>"];
  const blocked: string[] = [];
  for (const key of Object.keys(statData)) {
    if (key === "$meta") continue;
    const entry = statData[key];
    const necessary = isRecord(entry) && isRecord(entry.$meta) ? entry.$meta.necessary : undefined;
    if (necessary === "self" || necessary === "all") blocked.push(key);
  }
  return blocked;
}

export function durableRestoreInstruction(currentStat: unknown, statData: unknown): string | null {
  const blocked = protectedRootKeys(currentStat);
  if (blocked === null || blocked.length > 0 || !isRecord(statData) || !isRecord(currentStat)) return null;
  const deletePatch: Record<string, null> = {};
  for (const key of Object.keys(currentStat)) if (key !== "$meta") deletePatch[key] = null;
  const deleteBlock = Object.keys(deletePatch).length === 0 ? "" : `\n<VariableDelete>\n${JSON.stringify(deletePatch)}\n</VariableDelete>\n`;
  return `${deleteBlock}<VariableInsert>\n${JSON.stringify(cloneSyncJson(statData))}\n</VariableInsert>\n`;
}

/**
 * 以标准 Function 标签把当前库替换为目标库。删除不存在的函数在 CRUD 层是幂等
 * no-op，因此这个一删一插的恢复序列也能安全重放在新分支和复制聊天上。函数定义
 * 仍会在落盘后的完整同步中经过表达式 root 的完整调用图校验。
 */
export function durableFunctionRestoreInstruction(
  currentFunctions: unknown,
  targetFunctions: unknown,
): string | null {
  if (!isRecord(currentFunctions) || !isRecord(targetFunctions)) return null;
  const names = new Set([...Object.keys(currentFunctions), ...Object.keys(targetFunctions)]);
  const deletes = Object.fromEntries([...names].sort().map((name) => [name, {}]));
  const deleteBlock = Object.keys(deletes).length === 0
    ? ""
    : `\n<FunctionDelete>\n${JSON.stringify(deletes)}\n</FunctionDelete>\n`;
  const target = cloneSyncJson(targetFunctions);
  const insertBlock = Object.keys(target).length === 0
    ? ""
    : `<FunctionInsert>\n${JSON.stringify(target)}\n</FunctionInsert>\n`;
  return `${deleteBlock}${insertBlock}`;
}
