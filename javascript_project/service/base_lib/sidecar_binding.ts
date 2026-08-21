import { cloneEraPortableJsonV1 } from "@era/vibeflow-contracts";

/** Sidecar 的纯规则只依赖同步上下文中实际读取的字段，避免把 app 测试耦合到完整事务实现。 */
export interface SyncContextV1 {
  readonly step: unknown;
  readonly variablesRaw: unknown;
  readonly messagesRaw: unknown;
  readonly [key: string]: unknown;
}

/** `repair` 只用于本地记录缺失或损坏后的显式恢复，不是冲突弹窗的第四种分支。 */
export type SidecarChoiceV1 = "migrate" | "independent" | "copy" | "repair";
export type SidecarBindingStatusV1 = "not-applicable" | "create" | "matched" | "conflict" | "invalid" | "blocked";

export interface SidecarOwnerV1 {
  readonly characterId: string | null;
  readonly groupId: string | null;
  readonly chatId: string;
}

export interface SidecarRecordV1 {
  readonly schemaVersion: 1;
  readonly sidecarId: string;
  readonly owner: SidecarOwnerV1;
  readonly revision: number;
  readonly statData: unknown;
  readonly updatedAt: string;
}

export interface SidecarFactsV1 {
  readonly status: SidecarBindingStatusV1;
  readonly reason: string;
  readonly current: SidecarOwnerV1 | null;
  readonly sidecarId: string | null;
  readonly record: SidecarRecordV1 | null;
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

export function parseRecord(value: unknown, expectedId: string): SidecarRecordV1 | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.sidecarId !== expectedId || typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) ||
    value.revision < 0 || typeof value.updatedAt !== "string") return null;
  const recordOwner = owner(value.owner);
  if (recordOwner === null || !Object.prototype.hasOwnProperty.call(value, "statData")) return null;
  return { schemaVersion: 1, sidecarId: expectedId, owner: recordOwner, revision: value.revision, statData: cloneSyncJson(value.statData), updatedAt: value.updatedAt };
}

export function sidecarIdFromVariables(value: unknown): { readonly era: boolean; readonly sidecarId: string | null } {
  if (!isRecord(value)) return { era: false, sidecarId: null };
  const meta = value.ERAMetaData;
  if (!isRecord(meta)) return { era: false, sidecarId: null };
  const id = meta.SidecarId;
  return { era: true, sidecarId: typeof id === "string" && /^era_chat_[a-z0-9-]{8,80}$/iu.test(id) ? id : null };
}

export function inspectSidecar(currentRaw: unknown, recordRaw: unknown): SidecarFactsV1 {
  if (!isRecord(currentRaw)) return { status: "invalid", reason: "current-context-invalid", current: null, sidecarId: null, record: null };
  const current = owner(currentRaw.identity);
  const identity = sidecarIdFromVariables({ ERAMetaData: currentRaw.meta });
  if (!identity.era) return { status: "not-applicable", reason: "not-era-chat", current, sidecarId: null, record: null };
  if (current === null) return { status: "invalid", reason: "current-identity-invalid", current: null, sidecarId: identity.sidecarId, record: null };
  if (identity.sidecarId === null) return { status: "create", reason: "sidecar-id-absent", current, sidecarId: null, record: null };
  const recordEnvelope = isRecord(recordRaw) ? recordRaw : {};
  if (recordEnvelope.status === "missing") return { status: "invalid", reason: "sidecar-record-missing", current, sidecarId: identity.sidecarId, record: null };
  const record = recordEnvelope.status === "found" ? parseRecord(recordEnvelope.record, identity.sidecarId) : null;
  if (record === null) return { status: "invalid", reason: "sidecar-record-invalid", current, sidecarId: identity.sidecarId, record: null };
  if (sameOwner(current, record.owner)) return { status: "matched", reason: "owner-matched", current, sidecarId: identity.sidecarId, record };
  return { status: "conflict", reason: "owner-mismatch", current, sidecarId: identity.sidecarId, record };
}

export function choiceFromSyncContext(context: SyncContextV1): SidecarChoiceV1 | null {
  const step = isRecord(context.step) ? context.step : null;
  const task = step !== null && step.kind === "execute" && isRecord(step.task) && step.task.kind === "sync"
    ? step.task
    : null;
  const primaryEvent = task !== null && isRecord(task.primaryEvent) ? task.primaryEvent : null;
  // Service 输入不是 UI 原始对象：所有 transport args 都经过 ABI 的 tagged
  // envelope 编码。此前直接读取 args[0].choice，导致真实点击静默退化为普通
  // full sync；恰好提交后的镜像会写成功，却不会执行 Sidecar 事务或清除弹窗。
  if (primaryEvent?.type !== "era.ui.sidecar_binding_choice") return null;
  const args = primaryEvent.args;
  const envelope = Array.isArray(args) ? args[0] : undefined;
  const first = isRecord(envelope) && envelope.kind === "json" && isRecord(envelope.value)
    ? envelope.value
    : null;
  if (first === null) return null;
  return first.choice === "migrate" || first.choice === "independent" || first.choice === "copy" || first.choice === "repair"
    ? first.choice
    : null;
}

export function enrich(context: SyncContextV1, facts: SidecarFactsV1, route: "continue" | "blocked" | "applied", choice: SidecarChoiceV1 | null = null): EnrichedSyncContext {
  return { ...context, sidecarBinding: facts, sidecarBindingRoute: route, sidecarBindingChoice: choice };
}

export function resolveSidecar(facts: SidecarFactsV1, context: SyncContextV1): SidecarResolutionV1 {
  if (facts.status === "create") return { facts, route: "apply", choice: null };
  const choice = choiceFromSyncContext(context);
  // 本地镜像写入失败后，聊天内的 SidecarId 与旧文件记录仍会表现为 matched。
  // 此时只有 UI 明确发出的 repair 才允许重试文件提交；普通同步不能把它当成
  // 自动重试，更不能改变聊天变量或 owner。
  if (facts.status === "matched" && choice === "repair") return { facts, route: "apply", choice };
  if (facts.status === "not-applicable" || facts.status === "matched") return { facts, route: "continue", choice: null };
  if (facts.status === "conflict" && (choice === "migrate" || choice === "independent" || choice === "copy")) {
    return { facts, route: "apply", choice };
  }
  if (facts.status === "invalid" && choice === "repair") return { facts, route: "apply", choice };
  return { facts, route: "blocked", choice: null };
}

export function recordFor(id: string, current: SidecarOwnerV1, statData: unknown, previous: SidecarRecordV1 | null): SidecarRecordV1 {
  // 实际时间戳由 files Capability 写入时取得，避免纯规则读取宿主时钟。
  return { schemaVersion: 1, sidecarId: id, owner: current, revision: (previous?.revision ?? 0) + 1, statData: cloneSyncJson(statData), updatedAt: "pending-host-write" };
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

/**
 * 使用既有 CRUD 指令把当前根状态替换为恢复快照。根删除不能用空对象：CRUD 会把
 * 空对象视为无操作，因此显式删除每个当前顶层键；受保护根键则拒绝生成恢复文本。
 */
export function durableRestoreInstruction(currentStat: unknown, statData: unknown): string | null {
  const blocked = protectedRootKeys(currentStat);
  if (blocked === null || blocked.length > 0 || !isRecord(statData) || !isRecord(currentStat)) return null;
  const deletePatch: Record<string, null> = {};
  for (const key of Object.keys(currentStat)) {
    if (key !== "$meta") deletePatch[key] = null;
  }
  const deleteBlock = Object.keys(deletePatch).length === 0
    ? ""
    : `\n<VariableDelete>\n${JSON.stringify(deletePatch)}\n</VariableDelete>\n`;
  return `${deleteBlock}<VariableInsert>\n${JSON.stringify(cloneSyncJson(statData))}\n</VariableInsert>\n`;
}
