/**
 * ERA 同步事务的纯适配层。
 *
 * 本模块只负责规范化 Tavern JSON、调用纯同步引擎、构造逻辑提交 DTO 与最终
 * TaskResult。Capability 调用全部留在显式 data_store 节点中。
 */

import {
  readMessageKey,
  stripEraDataBlocks,
  type EraMkMessageV1,
  type EraMkSeedV1,
} from "./domain/mk_engine.ts";
import {
  planEraSync,
  type EraActionsTakenV1,
  type EraSyncMessageUpdateV1,
  type EraSyncPlanV1,
} from "./domain/sync_engine.ts";
import type {
  BatchExecutionStateV1,
  PlannedStepV1,
  TaskResultV1,
} from "./service_types.ts";
import {
  cloneEraPortableJsonV1,
  isEraDispatchContextV2,
  isEraDispatchContextV3,
  type EraAgentFloorCandidateV1,
  type EraDispatchContextV2,
  type EraDispatchContextV3,
  type EraFloorIdentityV1,
  type EraMessageSourceBasisV1,
  type JsonValue,
} from "@era/vibeflow-contracts";

export type SyncFailureCategory = "input" | "domain" | "tavern" | "cancelled";

export interface SyncFailureV1 {
  readonly code: string;
  readonly message: string;
  readonly category: SyncFailureCategory;
  readonly retryable: false;
  readonly details?: Readonly<Record<string, JsonValue>>;
}

export interface SyncContextV1 {
  readonly schemaVersion: 1;
  readonly step: PlannedStepV1;
  readonly state: BatchExecutionStateV1;
  readonly status: "ready" | "failed";
  readonly messagesRaw: unknown;
  readonly variablesRaw: unknown;
  readonly failure: SyncFailureV1 | null;
}

export interface SyncPayloadV1 {
  readonly mk: string;
  readonly message_id: number;
  readonly is_user: boolean;
  readonly actions: EraActionsTakenV1;
  readonly consecutiveProcessingCount: number;
}

export interface SyncWorkV1 {
  readonly schemaVersion: 1;
  readonly step: PlannedStepV1;
  readonly disposition: "commit" | "no-op" | "failed";
  readonly plan: EraSyncPlanV1 | null;
  readonly payload: SyncPayloadV1 | null;
  readonly failure: SyncFailureV1 | null;
}

export interface SyncMessageWriteV1 {
  readonly messageId: number;
  readonly content: string;
  readonly extra?: Readonly<Record<string, JsonValue>>;
}

export interface SyncCommitRequestV1 {
  readonly schemaVersion: 2;
  readonly step: PlannedStepV1;
  readonly plan: Exclude<EraSyncPlanV1, { readonly status: "failed" }>;
  /** 零消息同步没有可声称的消息身份；其状态提交显式使用 null。 */
  readonly payload: SyncPayloadV1 | null;
  readonly messageWrites: readonly SyncMessageWriteV1[];
  readonly stat: unknown;
  readonly statFunc: Readonly<Record<string, unknown>>;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly floorIdentity: EraFloorIdentityV1 | null;
  readonly agentFloorCandidate: EraAgentFloorCandidateV1 | null;
  /** 本次生成的最终展示变化；非持久化，不用于普通状态更新。 */
  readonly initialPresentation: EraFloorIdentityV1 | null;
  readonly sourceBasis: EraMessageSourceBasisV1;
}

export interface SyncMessageCommitV1 extends SyncCommitRequestV1 {
  readonly status: "ready" | "failed" | "fatal";
  readonly confirmedMessageWrites: number;
  readonly variablesCommitted: false;
  readonly failure: SyncFailureV1 | null;
}

/** 已确认消息写入后的事实，供 Sidecar 写入、发布和首次呈现共同使用。 */
export function basisAfterSyncWrites(request: SyncCommitRequestV1): EraMessageSourceBasisV1 {
  const writes = new Map(request.messageWrites.map(write => [write.messageId, write.content]));
  return {
    identity: request.sourceBasis.identity,
    messages: request.sourceBasis.messages.map(message => ({
      ...message,
      activeText: writes.get(message.messageId) ?? message.activeText,
    })),
  };
}

export interface SyncCommitResultV1 extends SyncCommitRequestV1 {
  readonly status: "committed" | "no-op" | "failed" | "fatal";
  readonly confirmedMessageWrites: number;
  readonly variablesCommitted: boolean;
  readonly failure: SyncFailureV1 | null;
  readonly sourceChanged?: boolean;
  readonly presentationDiagnostic?: Readonly<{
    code: string;
    message: string;
  }>;
}

export type SyncCommitEnvelopeV1 =
  | { readonly mode: "non-commit"; readonly work: SyncWorkV1 }
  | { readonly mode: "commit"; readonly request: SyncCommitRequestV1 };

export interface SyncCommitContractFailureV1 {
  readonly schemaVersion: 1;
  readonly step: PlannedStepV1;
  readonly failure: SyncFailureV1;
}

export type WriteObservation =
  | { readonly kind: "confirmed" }
  | { readonly kind: "not-written"; readonly message: string }
  | { readonly kind: "unknown"; readonly message: string };

class SyncContractError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SyncContractError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** 把宿主值收敛为可移植 JSON，并把数组空洞/undefined 固定为 null。 */
export function cloneSyncJson<T>(value: T, path = "$", depth = 0): T {
  void path;
  void depth;
  return cloneEraPortableJsonV1(value) as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}

export function isCancellation(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (isRecord(error) && error.name === "AbortError") ||
    /abort|cancel|取消/i.test(errorMessage(error))
  );
}

export function syncFailure(
  code: string,
  message: string,
  category: SyncFailureCategory,
  details?: Readonly<Record<string, JsonValue>>,
): SyncFailureV1 {
  return {
    code,
    message,
    category,
    retryable: false,
    ...(details === undefined ? {} : { details: cloneSyncJson(details) }),
  };
}

export function assertSyncStep(
  value: unknown,
): Extract<PlannedStepV1, { readonly kind: "execute" }> {
  if (!isRecord(value) || value.kind !== "execute") {
    throw new TypeError("同步任务只接受 execute 步骤。");
  }
  const task = value.task;
  if (!isRecord(task) || task.kind !== "sync") {
    throw new TypeError("同步任务收到的领域任务不是 sync。");
  }
  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    throw new TypeError("同步任务没有可结算来源。");
  }
  return value as unknown as Extract<
    PlannedStepV1,
    { readonly kind: "execute" }
  >;
}

export function assertBatchState(value: unknown): BatchExecutionStateV1 {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(value.nextState)
  ) {
    throw new TypeError("同步任务缺少有效的批次执行状态。");
  }
  const next = value.nextState;
  if (
    !Number.isSafeInteger(next.consecutiveProcessingCount) ||
    Number(next.consecutiveProcessingCount) < 0 ||
    (next.consecutiveMk !== null &&
      (typeof next.consecutiveMk !== "string" ||
        next.consecutiveMk.length === 0))
  ) {
    throw new TypeError("批次执行状态的连续 MK 字段无效。");
  }
  return value as unknown as BatchExecutionStateV1;
}

function unwrapSuccessful(value: unknown, depth = 0): unknown {
  if (!isRecord(value) || depth > 4) return value;
  if (value.ok === false) {
    throw isRecord(value.error)
      ? value.error
      : new Error(errorMessage(value.error));
  }
  if (
    value.ok === true &&
    Object.prototype.hasOwnProperty.call(value, "value")
  ) {
    return unwrapSuccessful(value.value, depth + 1);
  }
  return value;
}

function variablesRecord(value: unknown, depth = 0): Record<string, unknown> {
  const unwrapped = unwrapSuccessful(value);
  if (!isRecord(unwrapped) || depth > 4) {
    throw new TypeError("变量读取结果不是对象。");
  }
  if (
    Object.prototype.hasOwnProperty.call(unwrapped, "stat_data") ||
    Object.prototype.hasOwnProperty.call(unwrapped, "ERAMetaData") ||
    Object.prototype.hasOwnProperty.call(unwrapped, "stat") ||
    Object.prototype.hasOwnProperty.call(unwrapped, "meta")
  ) {
    return unwrapped;
  }
  for (const key of ["variables", "value", "data", "chat"]) {
    if (isRecord(unwrapped[key]))
      return variablesRecord(unwrapped[key], depth + 1);
  }
  return unwrapped;
}

function messageArray(value: unknown, depth = 0): readonly unknown[] {
  const unwrapped = unwrapSuccessful(value);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (!isRecord(unwrapped) || depth > 4) {
    throw new TypeError("消息读取结果不是数组。");
  }
  for (const key of ["messages", "value", "data", "chat"]) {
    const nested = unwrapped[key];
    if (Array.isArray(nested)) return nested;
    if (isRecord(nested)) return messageArray(nested, depth + 1);
  }
  throw new TypeError("消息读取结果缺少 messages 数组。");
}

function normalizeMessage(value: unknown, index: number): EraMkMessageV1 {
  if (!isRecord(value)) throw new TypeError(`消息 #${index} 不是对象。`);
  if (value.schemaVersion !== 1)
    throw new TypeError(`消息 #${index} 缺少严格投影版本。`);
  const rawId = value.messageId;
  if (!Number.isSafeInteger(rawId) || Number(rawId) < 0) {
    throw new TypeError(`消息 #${index} 缺少非负整数 message_id。`);
  }
  if (
    typeof value.role !== "string" ||
    value.role.length === 0 ||
    typeof value.activeText !== "string"
  ) {
    throw new TypeError(`消息 #${index} 缺少角色或当前激活文本。`);
  }
  return {
    messageId: Number(rawId),
    role: value.role,
    content: { kind: "text", text: value.activeText },
  };
}

type DispatchContext = EraDispatchContextV2 | EraDispatchContextV3;

function dispatchContext(step: PlannedStepV1): DispatchContext {
  const value = assertSyncStep(step).dispatchContext;
  if (!isEraDispatchContextV2(value) && !isEraDispatchContextV3(value)) {
    throw new TypeError("同步步骤缺少有效的 EraDispatchContextV2/V3。");
  }
  return value;
}

function stableBase36Token(source: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, "0");
}

function seedFor(
  step: PlannedStepV1,
  message: EraMkMessageV1,
  index: number,
): EraMkSeedV1 {
  const task = assertSyncStep(step).task;
  if (task.kind !== "sync") throw new TypeError("同步种子收到非同步任务。");
  const timestamp = Math.max(0, Math.trunc(task.primaryEvent.occurredAt));
  return {
    timestamp,
    token: stableBase36Token(
      `${task.primaryEvent.eventId}:${task.primaryEvent.sequence}:${message.messageId}:${index}`,
    ),
  };
}

function targetIndex(
  step: PlannedStepV1,
  messages: readonly EraMkMessageV1[],
): { readonly targetMessageId?: number; readonly stopAtTarget: boolean } {
  const task = assertSyncStep(step).task;
  if (task.kind !== "sync") throw new TypeError("同步目标收到非同步任务。");
  if (task.target.kind === "auto") return { stopAtTarget: false };
  if (task.target.kind === "previous-of-latest") {
    const previous = messages.length - 2;
    return previous < 0
      ? { stopAtTarget: false }
      : { targetMessageId: previous, stopAtTarget: true };
  }
  const target = task.target;
  const index = messages.findIndex(
    (message) => message.messageId === target.messageId,
  );
  return {
    targetMessageId: index < 0 ? target.messageId : index,
    stopAtTarget: target.stopAfterTarget,
  };
}

function actionsForStep(
  step: PlannedStepV1,
  actions: EraActionsTakenV1,
): EraActionsTakenV1 {
  const task = assertSyncStep(step).task;
  if (task.kind !== "sync") throw new TypeError("同步动作收到非同步任务。");
  const isApi = dispatchContext(step).dispatchClass === "api";
  return {
    ...actions,
    api: isApi,
  };
}

function applyDispatchStatePolicy(
  plan: EraSyncPlanV1,
  step: PlannedStepV1,
  state: BatchExecutionStateV1,
): EraSyncPlanV1 {
  const context = dispatchContext(step);
  if (context.dispatchClass !== "api") return plan;
  return {
    ...plan,
    consecutiveProcessingCount: 1,
    nextConsecutiveState: {
      mk: state.nextState.consecutiveMk,
      count: state.nextState.consecutiveProcessingCount,
    },
  } as EraSyncPlanV1;
}

function successfulPlan(
  plan: EraSyncPlanV1,
): Exclude<EraSyncPlanV1, { readonly status: "failed" }> {
  if (plan.status === "failed") throw new TypeError("同步计划已经失败。");
  return plan;
}

function normalizePlan(
  plan: EraSyncPlanV1,
  preUpdates: readonly EraSyncMessageUpdateV1[],
  step: PlannedStepV1,
): EraSyncPlanV1 {
  if (plan.status === "failed") return plan;
  return {
    ...plan,
    committed: plan.committed || preUpdates.length > 0,
    actionsTaken: actionsForStep(step, plan.actionsTaken),
    messageUpdates: [...preUpdates, ...plan.messageUpdates],
  } as EraSyncPlanV1;
}

function payloadFor(
  step: PlannedStepV1,
  plan: Exclude<EraSyncPlanV1, { readonly status: "failed" }>,
  processingMessage: DispatchContext["processingMessage"],
  processingMk: string | null,
): SyncPayloadV1 {
  if (processingMessage === null) {
    throw new TypeError("同步公开 payload 缺少不可变 processing message。");
  }
  const count = plan.consecutiveProcessingCount;
  if (!Number.isSafeInteger(count) || Number(count) < 1) {
    throw new TypeError("同步计划缺少有效的连续处理次数。");
  }
  return {
    mk: processingMk ?? "",
    message_id: processingMessage.messageId,
    is_user: processingMessage.role === "user",
    actions: actionsForStep(step, plan.actionsTaken),
    consecutiveProcessingCount: Number(count),
  };
}

/** 从两个 Capability 读取结果生成唯一、无副作用的同步工作项。 */
export function planSyncWork(context: SyncContextV1): SyncWorkV1 {
  const step = assertSyncStep(context.step);
  if (context.status === "failed") {
    return {
      schemaVersion: 1,
      step,
      disposition: "failed",
      plan: null,
      payload: null,
      failure:
        context.failure ??
        syncFailure(
          "ERA_SYNC_CONTEXT_FAILED",
          "同步上下文读取失败但没有错误详情。",
          "tavern",
        ),
    };
  }
  const state = assertBatchState(context.state);
  try {
    const prepared = dispatchContext(step);
    if (prepared.status !== "ready") {
      throw new TypeError(
        prepared.failure?.message ?? "统一派发上下文不可用。",
      );
    }
    if (
      prepared.messages.length > 0 &&
      prepared.requirement === "latest-message-with-mk" &&
      (typeof prepared.processingMk !== "string" ||
        prepared.processingMk.length === 0)
    ) {
      throw new TypeError(
        "latest-message-with-mk 同步任务缺少非空 processing MK。",
      );
    }
    const variables = variablesRecord(context.variablesRaw);
    const stat = cloneSyncJson(variables.stat_data ?? variables.stat ?? {});
    const statFuncCandidate = variables.statFunc ?? {};
    if (!isPlainRecord(statFuncCandidate)) {
      throw new TypeError("Sidecar statFunc 不是对象。");
    }
    const statFunc = cloneSyncJson(statFuncCandidate);
    const metaCandidate = variables.ERAMetaData ?? variables.meta ?? {};
    if (!isRecord(metaCandidate)) {
      throw new TypeError("ERAMetaData 不是对象。");
    }
    const meta = cloneSyncJson(metaCandidate);
    const messages = messageArray(context.messagesRaw).map(normalizeMessage);
    if (messages.length === 0) {
      const plan = planEraSync({
        messages: [],
        stat,
        statFunc,
        meta,
        reason: step.task.kind === "sync" ? step.task.reason : "manual",
        processingMk: prepared.processingMk,
        consecutiveState: {
          mk: state.nextState.consecutiveMk,
          count: state.nextState.consecutiveProcessingCount,
        },
      });
      return {
        schemaVersion: 1,
        step,
        disposition: plan.committed ? "commit" : "no-op",
        plan,
        payload: null,
        failure: null,
      };
    }

    const task = step.task;
    if (task.kind !== "sync") throw new TypeError("同步计划收到非同步任务。");
    const preparedMessages = [...messages];
    const preUpdates: EraSyncMessageUpdateV1[] =
      prepared.schemaVersion === 3
        ? prepared.stagedMessageUpdates.map((update) => {
            const messageIndex = preparedMessages.findIndex(
              (message) => message.messageId === update.messageId,
            );
            if (messageIndex < 0 || prepared.processingMk === null) {
              throw new TypeError(
                "暂存消息更新缺少可验证的消息位置或 processing MK。",
              );
            }
            return {
              kind: "update-message-content" as const,
              messageId: update.messageId,
              messageIndex,
              mk: prepared.processingMk,
              content: { kind: "text" as const, text: update.content },
            };
          })
        : [];
    const processingMessage = prepared.processingMessage;
    const processingMk = prepared.processingMk;
    if (processingMessage === null) {
      throw new TypeError("同步任务缺少不可变 processing message。");
    }
    const processingMatches = preparedMessages.filter(
      (message) => message.messageId === processingMessage.messageId,
    );
    if (processingMatches.length !== 1) {
      throw new TypeError("当前消息快照必须唯一包含 processing message。");
    }

    const target = targetIndex(step, preparedMessages);
    const seeds = preparedMessages.map((message, index) =>
      seedFor(step, message, index),
    );
    const planned = applyDispatchStatePolicy(
      normalizePlan(
        planEraSync({
          messages: preparedMessages,
          stat,
          statFunc,
          meta,
          reason: task.reason,
          forceFullRebuild: task.fullRebuild,
          targetMessageId: target.targetMessageId,
          stopAtTarget: target.stopAtTarget,
          mkSeedsByIndex: seeds,
          processingMk,
          consecutiveState: {
            mk: state.nextState.consecutiveMk,
            count: state.nextState.consecutiveProcessingCount,
          },
        }),
        preUpdates,
        step,
      ),
      step,
      state,
    );
    if (planned.status === "failed") {
      return {
        schemaVersion: 1,
        step,
        disposition: "failed",
        plan: planned,
        payload: null,
        failure: syncFailure(
          planned.error.code,
          planned.error.message,
          "domain",
        ),
      };
    }
    const payload = payloadFor(
      step,
      successfulPlan(planned),
      processingMessage,
      processingMk,
    );
    return {
      schemaVersion: 1,
      step,
      disposition: planned.committed ? "commit" : "no-op",
      plan: planned,
      payload,
      failure: null,
    };
  } catch (error) {
    return {
      schemaVersion: 1,
      step,
      disposition: "failed",
      plan: null,
      payload: null,
      failure: syncFailure(
        "ERA_SYNC_PLAN_FAILED",
        errorMessage(error),
        "input",
      ),
    };
  }
}

/** 把纯计划收敛为消息先行、变量后置的逻辑提交请求。 */
export function buildSyncCommitRequest(work: SyncWorkV1): SyncCommitRequestV1 {
  const emptyCommit =
    work.plan !== null &&
    work.plan.status !== "failed" &&
    work.plan.messages.length === 0;
  if (
    work.disposition !== "commit" ||
    work.plan === null ||
    (work.payload === null && !emptyCommit)
  ) {
    throw new TypeError("只有 commit 同步工作项可以构造提交请求。");
  }
  const plan = successfulPlan(work.plan);
  const writesByMessageId = new Map<number, SyncMessageWriteV1>();
  for (const update of plan.messageUpdates) {
      if (update.content.kind !== "text") {
        throw new TypeError(
          `消息 #${update.messageId} 的多模态内容不能由当前 Tavern 文本提交边界安全写入。`,
        );
      }
      writesByMessageId.set(update.messageId, {
        messageId: update.messageId,
        content: update.content.text,
      });
  }
  const prepared = dispatchContext(work.step);
  if (prepared.schemaVersion !== 3 || prepared.sourceBasis === undefined) {
    throw new TypeError("同步提交缺少计算前的消息/聊天依据。");
  }
  const floorIdentity = prepared.schemaVersion === 3
    ? prepared.floorIdentity
    : null;
  const agentFloorCandidate = prepared.schemaVersion === 3
    ? prepared.agentFloorCandidate
    : null;
  if (agentFloorCandidate !== null) {
    writesByMessageId.set(agentFloorCandidate.messageId, {
      messageId: agentFloorCandidate.messageId,
      content: agentFloorCandidate.content,
      extra: cloneSyncJson(agentFloorCandidate.extra),
    });
  }
  const messageWrites = [...writesByMessageId.values()].sort(
    (left, right) => left.messageId - right.messageId,
  );
  const task = work.step.kind === "execute" ? work.step.task : null;
  const received = task?.kind === "sync" && task.primaryEvent.type === "message_received" &&
    task.reason !== "facade-commit";
  const original = prepared.sourceBasis.messages.find(
    message => message.messageId === floorIdentity?.messageId,
  );
  const finalWrite = messageWrites.find(write => write.messageId === floorIdentity?.messageId);
  // MK 本身不改变显示；只有本次收到的最终正文/占位符发生变化才补一次呈现。
  const nativeDisplayChanged = received && original?.role === "assistant" && finalWrite !== undefined &&
    stripEraDataBlocks(original.activeText).trimEnd() !== stripEraDataBlocks(finalWrite.content).trimEnd();
  const initialPresentation = agentFloorCandidate?.requiresInitialPresentation === true || nativeDisplayChanged
    ? floorIdentity
    : null;
  return {
    schemaVersion: 2,
    step: work.step,
    plan,
    payload: work.payload,
    messageWrites,
    stat: cloneSyncJson(plan.stat),
    statFunc: cloneSyncJson(plan.statFunc),
    meta: cloneSyncJson(plan.meta),
    floorIdentity,
    agentFloorCandidate,
    initialPresentation,
    sourceBasis: prepared.sourceBasis,
  };
}

function assertConsecutiveCandidate(plan: EraSyncPlanV1 | null): void {
  const next = plan?.nextConsecutiveState;
  if (next === null || next === undefined) return;
  if (
    !Number.isSafeInteger(next.count) ||
    next.count < 0 ||
    (next.mk !== null && (typeof next.mk !== "string" || next.mk.length === 0))
  ) {
    throw new TypeError("同步计划包含无效连续状态候选。");
  }
}

/** 在任何 Capability 写入前验证完整同步提交候选。 */
export function validateSyncCommitEnvelope(value: unknown):
  | { readonly route: "valid"; readonly envelope: SyncCommitEnvelopeV1 }
  | {
      readonly route: "failed";
      readonly failure: SyncCommitContractFailureV1;
    } {
  let step: PlannedStepV1 | null = null;
  try {
    if (
      !isRecord(value) ||
      (value.mode !== "commit" && value.mode !== "non-commit")
    ) {
      throw new TypeError("同步提交候选缺少有效 mode。");
    }
    if (value.mode === "non-commit") {
      if (!isRecord(value.work))
        throw new TypeError("无提交候选缺少同步工作项。");
      step = assertSyncStep(value.work.step);
      if (value.work.disposition === "commit") {
        throw new TypeError("commit 工作项不能封装为 non-commit。");
      }
      assertConsecutiveCandidate((value.work as unknown as SyncWorkV1).plan);
      cloneEraPortableJsonV1(
        buildSyncNonCommitResult(value.work as unknown as SyncWorkV1),
      );
      return {
        route: "valid",
        envelope: value as unknown as SyncCommitEnvelopeV1,
      };
    }
    if (!isRecord(value.request)) throw new TypeError("提交候选缺少请求。");
    const request = value.request as unknown as SyncCommitRequestV1;
    step = assertSyncStep(request.step);
    if (!isRecord(request.sourceBasis) || !isRecord(request.sourceBasis.identity) || !Array.isArray(request.sourceBasis.messages)) {
      throw new TypeError("同步提交缺少原始宿主依据。");
    }
    if (request.schemaVersion !== 2 || !isRecord(request.plan)) {
      throw new TypeError("同步提交请求或同步计划无效。");
    }
    const prepared = dispatchContext(step);
    const expectedMk = prepared.processingMk ?? "";
    const emptyCommit = request.plan.messages.length === 0;
    if (emptyCommit) {
      if (
        request.payload !== null ||
        prepared.processingMessage !== null ||
        expectedMk.length > 0
      ) {
        throw new TypeError("零消息同步提交不得伪造消息身份。");
      }
    } else {
      if (!isRecord(request.payload))
        throw new TypeError("同步提交请求缺少公开 payload。");
      if (request.payload.mk !== expectedMk) {
        throw new TypeError("公开 payload MK 与不可变 processing MK 不一致。");
      }
      if (
        prepared.requirement === "latest-message-with-mk" &&
        expectedMk.length === 0
      ) {
        throw new TypeError("latest-message-with-mk 提交候选不允许空 MK。");
      }
      if (
        prepared.processingMessage === null ||
        request.payload.message_id !== prepared.processingMessage.messageId ||
        request.payload.is_user !== (prepared.processingMessage.role === "user")
      ) {
        throw new TypeError(
          "公开 payload 的消息身份与 processing message 不一致。",
        );
      }
      if (
        !Number.isSafeInteger(request.payload.consecutiveProcessingCount) ||
        request.payload.consecutiveProcessingCount < 1
      ) {
        throw new TypeError("公开 payload 缺少有效连续处理次数。");
      }
    }
    assertConsecutiveCandidate(request.plan);
    if (!Array.isArray(request.messageWrites))
      throw new TypeError("消息提交列表无效。");
    const writtenIds = new Set<number>();
    for (const write of request.messageWrites) {
      if (
        !isRecord(write) ||
        !Number.isSafeInteger(write.messageId) ||
        Number(write.messageId) < 0 ||
        typeof write.content !== "string"
      )
        throw new TypeError("消息提交项无效。");
      if (writtenIds.has(Number(write.messageId))) {
        throw new TypeError("同一消息在原子提交中出现了重复写入。");
      }
      writtenIds.add(Number(write.messageId));
      if (write.extra !== undefined) cloneEraPortableJsonV1(write.extra);
    }
    if (request.initialPresentation != null) {
      const floor = request.floorIdentity;
      const write = request.messageWrites.find(item => item.messageId === floor?.messageId);
      const selected = Array.isArray(request.meta.SelectedMks) && floor !== null
        ? request.meta.SelectedMks[floor.messageId] : null;
      if (floor === null || !deepSyncEqual(request.initialPresentation, floor) ||
          selected !== floor.mk || write === undefined || readMessageKey({
            messageId: write.messageId, role: "assistant", content: { kind: "text", text: write.content },
          }) !== floor.mk) {
        throw new SyncContractError("ERA_FLOOR_IDENTITY_MISMATCH", "首次呈现目标与最终提交楼层不一致。");
      }
    }
    if (request.agentFloorCandidate !== null) {
      const candidate = request.agentFloorCandidate;
      const floor = request.floorIdentity;
      const processing = prepared.processingMessage;
      const messageIndex = request.plan.messages.findIndex(
        (message) => message.messageId === candidate.messageId,
      );
      const selected = Array.isArray(request.meta.SelectedMks)
        ? request.meta.SelectedMks[messageIndex]
        : null;
      const editLogs = isRecord(request.meta.EditLogs)
        ? request.meta.EditLogs
        : {};
      const functionEditLogs = isRecord(request.meta.FunctionEditLogs)
        ? request.meta.FunctionEditLogs
        : {};
      const finalWrite = request.messageWrites.find(
        (write) => write.messageId === candidate.messageId,
      );
      const finalMk = finalWrite === undefined
        ? null
        : readMessageKey({
            messageId: finalWrite.messageId,
            role: "assistant",
            content: { kind: "text", text: finalWrite.content },
          });
      const mismatch =
        floor === null ||
        processing === null ||
        messageIndex < 0 ||
        candidate.messageId !== floor.messageId ||
        candidate.swipeId !== floor.swipeId ||
        candidate.mk !== floor.mk ||
        prepared.processingMk !== floor.mk ||
        processing.messageId !== floor.messageId ||
        finalMk !== floor.mk ||
        selected !== floor.mk ||
        !Object.prototype.hasOwnProperty.call(editLogs, floor.mk) ||
        !Object.prototype.hasOwnProperty.call(functionEditLogs, floor.mk);
      if (mismatch) {
        throw new SyncContractError(
          "ERA_FLOOR_IDENTITY_MISMATCH",
          "最终消息、processing floor、SelectedMks、变量日志、函数日志与状态栏绑定 MK 不一致。",
        );
      }
    }
    cloneEraPortableJsonV1(request.stat);
    cloneEraPortableJsonV1(request.statFunc);
    cloneEraPortableJsonV1(request.meta);
    cloneEraPortableJsonV1(request.payload);
    return {
      route: "valid",
      envelope: value as unknown as SyncCommitEnvelopeV1,
    };
  } catch (error) {
    if (step === null) throw error;
    return {
      route: "failed",
      failure: {
        schemaVersion: 1,
        step,
        failure: syncFailure(
          error instanceof SyncContractError
            ? error.code
            : "ERA_SYNC_COMMIT_CONTRACT_INVALID",
          errorMessage(error),
          "domain",
        ),
      },
    };
  }
}

function observationRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) return {};
  if (
    value.ok === true &&
    Object.prototype.hasOwnProperty.call(value, "value")
  ) {
    return observationRecord(value.value);
  }
  if (value.ok === false && isRecord(value.error)) {
    return value.error;
  }
  return value;
}

/**
 * 只接受明确的成功或明确的“尚未写入”。其余返回、抛错、部分提交与迟到
 * 取消一律归为 unknown，调用方必须 fatal。
 */
export function observeWrite(value: unknown): WriteObservation {
  const record = observationRecord(value);
  if (
    record.status === "committed" ||
    record.status === "completed" ||
    record.status === "updated" ||
    record.committed === true
  ) {
    return { kind: "confirmed" };
  }
  const state = record.writeState ?? record.commitState ?? record.outcome;
  if (
    state === "not-written" ||
    state === "rejected-before-write" ||
    record.status === "not-written" ||
    record.written === false
  ) {
    return {
      kind: "not-written",
      message: errorMessage(record.message ?? value),
    };
  }
  return { kind: "unknown", message: errorMessage(record.message ?? value) };
}

export function deepSyncEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((value, index) => deepSyncEqual(value, right[index]))
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key, index) =>
          key === rightKeys[index] && deepSyncEqual(left[key], right[key]),
      )
    );
  }
  return false;
}

/** 提交返回携带回读变量时进行严格比对；没有回读字段时仍依赖显式 committed。 */
export function verifyCommittedVariables(
  value: unknown,
  request: SyncCommitRequestV1,
): boolean {
  const record = observationRecord(value);
  let observed: Record<string, unknown> | null = null;
  try {
    for (const key of ["variables", "value", "data", "chat"]) {
      if (isRecord(record[key])) {
        observed = variablesRecord(record[key]);
        break;
      }
    }
  } catch {
    return false;
  }
  if (observed === null) return true;
  const observedStat = observed.stat_data ?? observed.stat;
  const observedMeta = observed.ERAMetaData ?? observed.meta;
  return (
    deepSyncEqual(observedStat, request.stat) &&
    deepSyncEqual(observedMeta, request.meta)
  );
}

function sourceKey(eventId: string, sequence: number): string {
  return `${eventId}\u0000${sequence}`;
}

function assertUniqueSources(step: PlannedStepV1): void {
  const valid = assertSyncStep(step);
  if (valid.kind !== "execute") throw new TypeError("同步步骤不是 execute。");
  const seen = new Set<string>();
  for (const source of valid.sources) {
    const key = sourceKey(source.event.eventId, source.event.sequence);
    if (seen.has(key)) throw new TypeError("同步步骤包含重复来源。");
    seen.add(key);
  }
}

function diagnosticsForPlan(plan: EraSyncPlanV1 | null, step: PlannedStepV1) {
  const sequence =
    step.kind === "execute" ? step.task.primaryEvent.sequence : null;
  return (plan?.diagnostics ?? []).map((item) => ({
    code: item.code,
    message:
      item.messageIndex === null
        ? item.message
        : `${item.message}（消息索引 ${item.messageIndex}）`,
    sequence,
  }));
}

function stateUpdateForPlan(plan: EraSyncPlanV1 | null) {
  const next = plan?.nextConsecutiveState;
  return next === null || next === undefined
    ? undefined
    : {
        consecutiveMk: next.mk,
        consecutiveProcessingCount: next.count,
      };
}

function settlementsFor(
  step: PlannedStepV1,
  status: "committed" | "no-op" | "failed" | "fatal",
  failure: SyncFailureV1 | null,
) {
  assertUniqueSources(step);
  if (step.kind !== "execute") return [];
  return step.sources.map((source) => {
    if (status === "committed" || status === "no-op") {
      return {
        eventId: source.event.eventId,
        sequence: source.event.sequence,
        status: "completed" as const,
        taskId: step.task.id,
        relation: source.relation,
      };
    }
    const error =
      failure ??
      syncFailure(
        "ERA_SYNC_UNKNOWN_FAILURE",
        "同步任务失败但没有错误详情。",
        "domain",
      );
    if (error.category === "cancelled" && status !== "fatal") {
      return {
        eventId: source.event.eventId,
        sequence: source.event.sequence,
        status: "cancelled" as const,
        reason: error.message,
      };
    }
    return {
      eventId: source.event.eventId,
      sequence: source.event.sequence,
      status: "failed" as const,
      error,
    };
  });
}

/** 构造无写入分支的最终结果。 */
export function buildSyncNonCommitResult(work: SyncWorkV1): TaskResultV1 {
  if (work.disposition === "commit") {
    throw new TypeError("commit 工作项不能走无提交结果分支。");
  }
  const status = work.disposition === "no-op" ? "no-op" : "failed";
  const diagnostics = [
    ...diagnosticsForPlan(work.plan, work.step),
    ...(work.failure === null
      ? []
      : [
          {
            code: work.failure.code,
            message: work.failure.message,
            sequence:
              work.step.kind === "execute"
                ? work.step.task.primaryEvent.sequence
                : null,
          },
        ]),
  ];
  return {
    status,
    settlements: settlementsFor(work.step, status, work.failure),
    notifications: [],
    diagnostics,
    ...(stateUpdateForPlan(work.plan) === undefined
      ? {}
      : { stateUpdate: stateUpdateForPlan(work.plan) }),
  };
}

/** 把预提交合同失败转换为无副作用、逐来源结算的同步失败。 */
export function buildSyncContractFailureResult(
  candidate: SyncCommitContractFailureV1,
): TaskResultV1 {
  const step = assertSyncStep(candidate.step);
  const failure = candidate.failure;
  return {
    status: "failed",
    settlements: settlementsFor(step, "failed", failure),
    notifications: [],
    diagnostics: [
      {
        code: failure.code,
        message: failure.message,
        sequence: step.task.primaryEvent.sequence,
      },
    ],
  };
}

/** 只在全部消息与 Sidecar 写入已确认后结算；状态更新通过 runtime snapshot 发布。 */
export function buildSyncCommittedResult(
  outcome: SyncCommitResultV1,
): TaskResultV1 {
  const diagnostics = [
    ...diagnosticsForPlan(outcome.plan, outcome.step),
    ...(outcome.failure === null
      ? []
      : [
          {
            code: outcome.failure.code,
            message: outcome.failure.message,
            sequence:
              outcome.step.kind === "execute"
                ? outcome.step.task.primaryEvent.sequence
                : null,
          },
        ]),
    ...(outcome.presentationDiagnostic === undefined
      ? []
      : [
          {
            code: outcome.presentationDiagnostic.code,
            message: outcome.presentationDiagnostic.message,
            sequence:
              outcome.step.kind === "execute"
                ? outcome.step.task.primaryEvent.sequence
                : null,
          },
        ]),
  ];
  return {
    status: outcome.status,
    settlements: settlementsFor(outcome.step, outcome.status, outcome.failure),
    notifications: [],
    diagnostics,
    ...(outcome.sourceChanged || stateUpdateForPlan(outcome.plan) === undefined
      ? {}
      : { stateUpdate: stateUpdateForPlan(outcome.plan) }),
  };
}
