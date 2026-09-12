import type { EraTaskResultV1 } from "@era/vibeflow-contracts";
import {
  type ScopeWindowState,
  adaptSyncResult,
  buildAppend,
  buildCommittedResult,
  buildFailureResult,
  buildSkippedResult,
  buildSyncFailure,
  buildTransaction,
  inspectWindow,
  mergeExclusiveResults,
  planFacadeSync,
  prepareCommitSync,
  recheckWindow,
  routeFacadeCommand,
  validateCommit,
  verifyCommitted,
} from "../../base_lib/facade_api_engine.ts";
import type {
  BatchExecutionStateV1,
  PlannedStepV1,
} from "../../base_lib/service_types.ts";

interface Envelope<T> {
  readonly value: T;
}

interface Context {
  readonly capabilities: {
    readonly "era.tavern.messages": {
      read_context(input: Readonly<Record<string, unknown>>): Promise<unknown>;
      update_content(input: Readonly<Record<string, unknown>>): Promise<unknown>;
    };
    readonly "era.tavern.identity": {
      read(input: Readonly<Record<string, unknown>>): unknown;
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function envelope(inputs: Readonly<Record<string, Envelope<unknown>>>, key: string): unknown {
  const value = inputs[key]?.value;
  if (value === undefined) throw new TypeError(`缺少节点输入 ${key}。`);
  return value;
}

async function readMessages(context: Context, purpose: string): Promise<unknown> {
  return context.capabilities["era.tavern.messages"].read_context({
    projection: "era-active-message-v1",
    range: "0--1",
    purpose,
  });
}

function identityInput(purpose: string, rawRequest: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(rawRequest)) return { purpose };
  const detail = isRecord(rawRequest.detail) ? rawRequest.detail : {};
  return Object.prototype.hasOwnProperty.call(detail, "sourceContext")
    ? { purpose, sourceContext: detail.sourceContext }
    : { purpose };
}

export function routeFacadeNode(inputs: any): any {
  const routed = routeFacadeCommand(
    envelope(inputs, "era.step.request.routed") as PlannedStepV1,
    envelope(inputs, "era.batch.execution.state") as BatchExecutionStateV1,
  );
  return {
    facade_request: routed.request,
    facade_route: routed.route,
    facade_execution_state: routed.executionState,
  };
}

export async function readWindowNode(
  inputs: any,
  _params: any,
  context: any,
): Promise<any> {
  const request = envelope(inputs, "era.api.request");
  const identity = context.capabilities["era.tavern.identity"].read(identityInput("era-facade-window", request));
  const messages = await readMessages(context, "era-facade-window");
  return {
    facade_commit_inspected: inspectWindow(
      request,
      envelope(inputs, "era.batch.execution.state") as BatchExecutionStateV1,
      identity,
      messages,
    ),
  };
}

export function validateCommitNode(inputs: any): any {
  const result = validateCommit(envelope(inputs, "era.api.commit.inspected"));
  return {
    commit_admission_route: result.route,
    facade_commit_validated: result.context,
    facade_commit_validation_failure: result,
  };
}

export function buildTransactionNode(inputs: any): any {
  return { facade_commit_transaction: buildTransaction(envelope(inputs, "era.api.commit.validated")) };
}

export async function readTargetNode(
  inputs: any,
  _params: any,
  context: any,
): Promise<any> {
  const candidate = envelope(inputs, "era.api.commit.transaction");
  const messages = await readMessages(context, "era-facade-commit-target");
  const request = isRecord(candidate) ? candidate.request : null;
  const identity = context.capabilities["era.tavern.identity"].read(identityInput("era-facade-commit-target", request));
  if (!isRecord(candidate)) throw new TypeError("era_tx 上下文损坏。");
  const refreshed = inspectWindow(candidate.request, candidate.executionState as BatchExecutionStateV1, identity, messages);
  return { facade_commit_target: { ...candidate, messages: refreshed.messages, latest: refreshed.latest } };
}

export function buildAppendNode(inputs: any): any {
  return { facade_commit_append_request: buildAppend(envelope(inputs, "era.api.commit.target")) };
}

export function recheckWindowNode(
  inputs: any,
  _params: any,
  context: any,
): any {
  const append = envelope(inputs, "era.api.commit.append.request");
  const request = isRecord(append) ? append.request : null;
  const current = context.capabilities["era.tavern.identity"].read(identityInput("era-facade-pre-write", request));
  const result = recheckWindow(append, current);
  return {
    window_recheck_route: result.route,
    facade_commit_rechecked: result.context,
    facade_commit_recheck_failure: result,
  };
}

export async function commitAppendNode(
  inputs: any,
  _params: any,
  context: any,
): Promise<any> {
  const candidate = envelope(inputs, "era.api.commit.rechecked");
  if (!isRecord(candidate) || !isRecord(candidate.capabilityInput)) {
    throw new TypeError("已复核 commit 缺少消息写入参数。");
  }
  // 依据必须在**写入前**重新读一遍：这条门面命令的 window/依据可能是事件派发时捕获的
  // （`prepared.sourceBasis`），而新楼层可能在这之后才落地——真机 STATUSBAR-EXAMPLE-020 的
  // 自动重渲染就是这样被拒的（basis 3 条、聊天 4 条 ⇒ `message-count`）。
  // 只刷新 messages：identity 沿用计划，目标消息的正文若也变了，宿主仍会以 `source-text` 拒绝。
  const capabilityInput = { ...(candidate.capabilityInput as Record<string, unknown>) };
  const plannedBasis = isRecord(capabilityInput.sourceBasis) ? capabilityInput.sourceBasis : null;
  if (plannedBasis !== null) {
    const fresh = await readMessages(context, "era-facade-append");
    if (Array.isArray(fresh)) {
      capabilityInput.sourceBasis = { ...plannedBasis, messages: fresh };
    }
  }
  try {
    const observed = await context.capabilities["era.tavern.messages"].update_content(capabilityInput);
    const accepted = isRecord(observed) &&
      (observed.ok === true || ["committed", "completed", "success"].includes(String(observed.status)));
    return {
      facade_commit_append_result: accepted
        ? { status: "committed", context: candidate, observed }
        : { status: "failed", context: candidate, observed },
    };
  } catch (error) {
    // AOT 的 Capability 边界会把内层异常包成 `VF_CAPABILITY_FAILED`，真正的原因在 `cause`
    // （与 `commit_sync.changedSource` 同一处理）。不解开的话，作者与诊断只能看到
    // 「capability 'era.tavern.messages.update_content' failed」这种无信息量的包装，
    // 真机 STATUSBAR-EXAMPLE-020 的 `ERA_API_MESSAGE_APPEND_FAILED` 就是这样失去线索的。
    const unwrapped =
      error !== null && typeof error === "object" &&
      (error as { code?: unknown }).code === "VF_CAPABILITY_FAILED" &&
      (error as { cause?: unknown }).cause !== undefined
        ? (error as { cause: unknown }).cause
        : error;
    return {
      facade_commit_append_result: {
        status: "failed",
        context: candidate,
        observed: {
          message: unwrapped instanceof Error ? unwrapped.message : String(unwrapped),
          ...(unwrapped !== null && typeof unwrapped === "object" &&
              typeof (unwrapped as { code?: unknown }).code === "string"
            ? { code: (unwrapped as { code: string }).code }
            : {}),
        },
      },
    };
  }
}

export async function verifyCommitNode(
  inputs: any,
  _params: any,
  context: any,
): Promise<any> {
  const append = envelope(inputs, "era.api.commit.append.result");
  const messages = await readMessages(context, "era-facade-post-commit");
  const result = verifyCommitted(append, messages);
  return {
    commit_readback_route: result.route,
    facade_commit_verified: result.context,
    facade_commit_readback_failure: result,
  };
}

export function prepareCommitSyncNode(inputs: any): any {
  const prepared = prepareCommitSync(envelope(inputs, "era.api.commit.verified"));
  const executionState = prepared.context.executionState as BatchExecutionStateV1;
  const nextExecutionState: BatchExecutionStateV1 = {
    ...executionState,
    nextState: {
      ...executionState.nextState,
      // 与下方 `nextState.scopeWindow` 同一口径：窗口形状由门面引擎保证，这里按既有约定断言。
      scopeWindow: prepared.context.window as ScopeWindowState,
    },
  };
  return {
    commit_sync_step: prepared.syncStep,
    facade_commit_sync_context: prepared.context,
    commit_execution_state: nextExecutionState,
  };
}

export function committedReceiptNode(inputs: any): any {
  return {
    facade_commit_committed_result: buildCommittedResult(
      envelope(inputs, "era.task.result") as EraTaskResultV1,
      envelope(inputs, "era.api.commit.sync_context"),
    ),
  };
}

export function skippedReceiptNode(inputs: any): any {
  return { facade_commit_skipped_result: buildSkippedResult(envelope(inputs, "era.api.commit.validated")) };
}

export function commitFailureNode(inputs: any): any {
  return { facade_commit_failed_result: buildFailureResult(envelope(inputs, "era.api.commit.failure_context")) };
}

export function mergeCommitNode(inputs: any): any {
  const input = inputs["era.api.commit.result"];
  const values = Array.isArray(input) ? input.map((item) => item.value) : [input?.value];
  return { commit_result: mergeExclusiveResults(values.filter(Boolean) as EraTaskResultV1[]) };
}

export function planSyncNode(inputs: any): any {
  const planned = planFacadeSync(envelope(inputs, "era.api.request"));
  return {
    facade_sync_route: planned.route,
    facade_sync_step: isRecord(planned) ? planned.syncStep ?? null : null,
    facade_sync_context: planned,
    facade_sync_execution_state: envelope(inputs, "era.batch.execution.state"),
  };
}

export function adaptSyncNode(inputs: any): any {
  return {
    facade_sync_committed_result: adaptSyncResult(
      envelope(inputs, "era.task.result") as EraTaskResultV1,
      envelope(inputs, "era.api.sync.context"),
    ),
  };
}

export function syncFailureNode(inputs: any): any {
  return { facade_sync_failed_result: buildSyncFailure(envelope(inputs, "era.api.sync.context")) };
}

export function mergeSyncNode(inputs: any): any {
  const input = inputs["era.api.sync.result"];
  const values = Array.isArray(input) ? input.map((item) => item.value) : [input?.value];
  return { sync_result: mergeExclusiveResults(values.filter(Boolean) as EraTaskResultV1[]) };
}

export function mergeFacadeNode(inputs: any): any {
  const input = inputs["era.api.facade.result"];
  const values = Array.isArray(input) ? input.map((item) => item.value) : [input?.value];
  return { api_task_result: mergeExclusiveResults(values.filter(Boolean) as EraTaskResultV1[]) };
}
