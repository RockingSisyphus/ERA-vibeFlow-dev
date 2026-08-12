import {
  assertBatchState,
  assertSyncStep,
  errorMessage,
  isCancellation,
  syncFailure,
  type SyncContextV1,
} from "../../base_lib/sync_transaction.ts";

interface Envelope<T> {
  readonly value: T;
}

interface Context {
  readonly capabilities: {
    readonly "era.tavern.variables": {
      readonly read: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function run(
  inputs: Readonly<{
    "era.step.request.routed": Envelope<unknown>;
    "era.batch.execution.state": Envelope<unknown>;
  }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  const step = assertSyncStep(inputs["era.step.request.routed"].value);
  const state = assertBatchState(inputs["era.batch.execution.state"].value);
  const dispatchContext = isRecord(step.dispatchContext) ? step.dispatchContext : null;
  let variablesRaw: unknown = null;
  const messagesRaw = dispatchContext === null
    ? null
    : { schemaVersion: 2, messages: dispatchContext.messages };
  try {
    if (dispatchContext?.status !== "ready") {
      throw new TypeError(String(isRecord(dispatchContext?.failure) ? dispatchContext.failure.message : "统一派发上下文不可用。"));
    }
    variablesRaw = await context.capabilities["era.tavern.variables"].read({
      scope: { type: "chat" },
      purpose: "era-sync-read",
    });
    const result: SyncContextV1 = {
      schemaVersion: 1,
      step,
      state,
      status: "ready",
      messagesRaw,
      variablesRaw,
      failure: null,
    };
    return {
      sync_context: result as unknown as Readonly<Record<string, unknown>>,
    };
  } catch (error) {
    const cancelled = isCancellation(error);
    const result: SyncContextV1 = {
      schemaVersion: 1,
      step,
      state,
      status: "failed",
      messagesRaw,
      variablesRaw,
      failure: syncFailure(
        cancelled ? "ERA_SYNC_READ_CANCELLED" : "ERA_SYNC_READ_FAILED",
        errorMessage(error),
        cancelled ? "cancelled" : "tavern",
      ),
    };
    return {
      sync_context: result as unknown as Readonly<Record<string, unknown>>,
    };
  }
}
