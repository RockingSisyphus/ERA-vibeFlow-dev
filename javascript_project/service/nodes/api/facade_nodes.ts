import { overlayWorkingMessages } from "../../base_lib/working_state.ts";
import type { EraTaskResultV1 } from "@era/vibeflow-contracts";
import {
  adaptSyncResult,
  buildFailureResult,
  buildSkippedResult,
  buildSyncFailure,
  buildTransaction,
  inspectWindow,
  mergeExclusiveResults,
  planFacadeSync,
  routeFacadeCommand,
  recheckWindow,
  validateCommit,
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
      update_content(
        input: Readonly<Record<string, unknown>>,
      ): Promise<unknown>;
    };
    readonly "era.tavern.sidecar": {
      read_working(input: Readonly<Record<string, unknown>>): any;
    };
    readonly "era.tavern.identity": {
      read(input: Readonly<Record<string, unknown>>): unknown;
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function envelope(
  inputs: Readonly<Record<string, Envelope<unknown>>>,
  key: string,
): unknown {
  const value = inputs[key]?.value;
  if (value === undefined) throw new TypeError(`缺少节点输入 ${key}。`);
  return value;
}

async function readMessages(
  context: Context,
  purpose: string,
): Promise<unknown> {
  const raw = await context.capabilities["era.tavern.messages"].read_context({
    projection: "era-active-message-v1",
    range: "0--1",
    purpose,
  });
  return overlayWorkingMessages(
    raw,
    context.capabilities["era.tavern.sidecar"].read_working({}).working,
  );
}

function identityInput(
  purpose: string,
  rawRequest: unknown,
): Readonly<Record<string, unknown>> {
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

function workingRequest(request: any, raw: any, context: Context): any {
  const working = context.capabilities["era.tavern.sidecar"].read_working(
    {},
  ).working;
  if (!working?.dirty) return request;
  const dispatch = request.dispatchContext;
  if (!dispatch || !Array.isArray(raw?.messages)) return request;
  const pending = raw.messages.find(
    (message: any) =>
      message.messageId ===
      (working.stage?.messageId ?? dispatch.processingMessage?.messageId),
  );
  if (!pending) return request;
  return {
    ...request,
    dispatchContext: {
      ...dispatch,
      processingMessage: pending,
      ...(working.stage
        ? {
            processingMk: working.stage.mk,
            floorIdentity: {
              chatId: working.stage.chatId,
              messageId: working.stage.messageId,
              swipeId: working.stage.swipeId,
              mk: working.stage.mk,
            },
          }
        : {}),
    },
  };
}

export async function readWindowNode(
  inputs: any,
  _params: any,
  context: any,
): Promise<any> {
  const request = envelope(inputs, "era.api.request");
  try {
    const identity = context.capabilities["era.tavern.identity"].read(
      identityInput("era-facade-window", request),
    );
    const messages = await readMessages(context, "era-facade-window");
    return {
      facade_commit_inspected: inspectWindow(
        workingRequest(request, messages, context),
        envelope(inputs, "era.batch.execution.state") as BatchExecutionStateV1,
        identity,
        messages,
      ),
    };
  } catch (error) {
    const executionState = envelope(
      inputs,
      "era.batch.execution.state",
    ) as BatchExecutionStateV1;
    return {
      facade_commit_inspected: {
        request,
        executionState,
        window: executionState.nextState.scopeWindow,
        readFailure: {
          code: "ERA_API_CONTEXT_READ_FAILED",
          message: error instanceof Error ? error.message : String(error),
          layer: "tavern",
        },
      },
    };
  }
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
  return {
    facade_commit_transaction: buildTransaction(
      envelope(inputs, "era.api.commit.validated"),
    ),
  };
}

export async function readTargetNode(
  inputs: any,
  _params: any,
  context: any,
): Promise<any> {
  const candidate = envelope(inputs, "era.api.commit.transaction");
  try {
    const messages = await readMessages(context, "era-facade-commit-target");
    const request = isRecord(candidate) ? candidate.request : null;
    const identity = context.capabilities["era.tavern.identity"].read(
      identityInput("era-facade-commit-target", request),
    );
    if (!isRecord(candidate)) throw new TypeError("era_tx 上下文损坏。");
    const checked = recheckWindow(candidate, identity);
    if (checked.route !== "current")
      return {
        facade_commit_target: { ...candidate, readFailure: checked.error },
      };
    const refreshed = inspectWindow(
      workingRequest(candidate.request, messages, context),
      candidate.executionState as BatchExecutionStateV1,
      identity,
      messages,
    );
    return {
      facade_commit_target: {
        ...candidate,
        messages: refreshed.messages,
        latest: candidate.latest,
      },
    };
  } catch (error) {
    return {
      facade_commit_target: {
        ...(candidate as object),
        readFailure: {
          code: "ERA_API_TARGET_READ_FAILED",
          message: error instanceof Error ? error.message : String(error),
          layer: "tavern",
        },
      },
    };
  }
}

export function skippedReceiptNode(inputs: any): any {
  return {
    facade_commit_skipped_result: buildSkippedResult(
      envelope(inputs, "era.api.commit.validated"),
    ),
  };
}

export function commitFailureNode(inputs: any): any {
  return {
    facade_commit_failed_result: buildFailureResult(
      envelope(inputs, "era.api.commit.failure_context"),
    ),
  };
}

export function mergeCommitNode(inputs: any): any {
  const input = inputs["era.api.commit.result"];
  const values = Array.isArray(input)
    ? input.map((item) => item.value)
    : [input?.value];
  return {
    commit_result: mergeExclusiveResults(
      values.filter(Boolean) as EraTaskResultV1[],
    ),
  };
}

export function planSyncNode(inputs: any): any {
  const planned = planFacadeSync(envelope(inputs, "era.api.request"));
  return {
    facade_sync_route: planned.route,
    facade_sync_step: isRecord(planned) ? (planned.syncStep ?? null) : null,
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
  return {
    facade_sync_failed_result: buildSyncFailure(
      envelope(inputs, "era.api.sync.context"),
    ),
  };
}

export function mergeSyncNode(inputs: any): any {
  const input = inputs["era.api.sync.result"];
  const values = Array.isArray(input)
    ? input.map((item) => item.value)
    : [input?.value];
  return {
    sync_result: mergeExclusiveResults(
      values.filter(Boolean) as EraTaskResultV1[],
    ),
  };
}

export function mergeFacadeNode(inputs: any): any {
  const input = inputs["era.api.facade.result"];
  const values = Array.isArray(input)
    ? input.map((item) => item.value)
    : [input?.value];
  return {
    api_task_result: mergeExclusiveResults(
      values.filter(Boolean) as EraTaskResultV1[],
    ),
  };
}
