import {
  type JsonValue,
  type EraFloorIdentityV1,
  type EraAgentFloorCandidateV1,
  type EraMessageSourceBasisV1,
  cloneEraPortableJsonV1,
  type EraDispatchContextV2,
  type EraDispatchContextV3,
  isEraDispatchContextV2,
  isEraDispatchContextV3,
} from "@era/vibeflow-contracts";
import {
  type PlannedStepV1,
  type BatchExecutionStateV1,
} from "./service_types.ts";
import {
  type EraActionsTakenV1,
  type EraSyncPlanV1,
} from "./domain/sync_engine.ts";

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
  readonly consecutive: SyncConsecutiveFacts;
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

/**
 * 一次消息内函数调用的交接事实。
 *
 * 调用在块边界被无条件断开：本批次不提交任何状态，只把「调用位置」交给 Host。
 * `stat`/`statFunc` 是调用位置的累计状态，供函数读取自己所在位置的状态；它不是
 * 已提交状态，函数产出仍会作为操作区随该消息一起提交。
 */
export interface EraMessageFunctionHandoffV1 {
  readonly schemaVersion: 1;
  readonly messageId: number;
  readonly mk: string;
  readonly blockIndex: number;
  readonly callId: string;
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly stat: Readonly<Record<string, unknown>>;
  readonly statFunc: Readonly<Record<string, unknown>>;
}

export interface SyncWorkV1 {
  readonly schemaVersion: 1;
  readonly step: PlannedStepV1;
  readonly disposition: "commit" | "no-op" | "failed";
  readonly plan: EraSyncPlanV1 | null;
  readonly payload: SyncPayloadV1 | null;
  readonly failure: SyncFailureV1 | null;
  /** 需要 Host 在步骤之外执行的调用；存在时本工作项必然不提交。 */
  readonly handoff?: EraMessageFunctionHandoffV1;
  /** 附加给 Host 的后置通知；当前只有函数交接使用。 */
  readonly notifications?: readonly SyncNotificationV1[];
}

export interface SyncNotificationV1 {
  readonly type: string;
  readonly args: readonly JsonValue[];
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

export class SyncContractError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SyncContractError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
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

export function unwrapSuccessful(value: unknown, depth = 0): unknown {
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

export function variablesRecord(
  value: unknown,
  depth = 0,
): Record<string, unknown> {
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

export type DispatchContext = EraDispatchContextV2 | EraDispatchContextV3;

export function dispatchContext(step: PlannedStepV1): DispatchContext {
  const value = assertSyncStep(step).dispatchContext;
  if (!isEraDispatchContextV2(value) && !isEraDispatchContextV3(value)) {
    throw new TypeError("同步步骤缺少有效的 EraDispatchContextV2/V3。");
  }
  return value;
}

export function successfulPlan(
  plan: EraSyncPlanV1,
): Exclude<EraSyncPlanV1, { readonly status: "failed" }> {
  if (plan.status === "failed") throw new TypeError("同步计划已经失败。");
  return plan;
}

/** 批次编排只向同步计算提供这两个事实。 */
export interface SyncConsecutiveFacts {
  readonly mk: string | null;
  readonly count: number;
}
export interface SyncPlanningInput {
  readonly step: PlannedStepV1;
  readonly consecutive: SyncConsecutiveFacts;
  readonly status: "ready" | "failed";
  readonly messagesRaw: unknown;
  readonly variablesRaw: unknown;
  readonly failure: SyncFailureV1 | null;
}
export function consecutiveFacts(value: unknown): SyncConsecutiveFacts {
  const state = assertBatchState(value);
  return {
    mk: state.nextState.consecutiveMk,
    count: state.nextState.consecutiveProcessingCount,
  };
}
