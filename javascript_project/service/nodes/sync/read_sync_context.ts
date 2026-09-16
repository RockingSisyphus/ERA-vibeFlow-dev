import {
  consecutiveFacts,
  assertSyncStep,
  errorMessage,
  isCancellation,
  syncFailure,
  type SyncContextV1,
} from "../../base_lib/sync_contracts.ts";

interface Envelope<T> {
  readonly value: T;
}

type Context = any;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * 从批次状态读块级续做游标。
 *
 * 契约校验器负责形状；这里只做「缺省即 null」的读取。游标形状非法时按没有游标处理，
 * 让恢复退回「从楼层起点重算」这条安全路径，而不是拿半个游标去续做。
 */
function batchSyncCursor(value: unknown): SyncContextV1["syncCursor"] {
  const nextState =
    isRecord(value) && isRecord(value.nextState) ? value.nextState : null;
  if (nextState === null) return null;
  const cursor = nextState.syncCursor;
  if (cursor === null || cursor === undefined) return null;
  if (!isRecord(cursor)) return null;
  const messageId = cursor.messageId;
  const mk = cursor.mk;
  const blockIndex = cursor.blockIndex;
  if (!Number.isSafeInteger(messageId) || Number(messageId) < 0) return null;
  if (typeof mk !== "string" || mk.length === 0) return null;
  if (!Number.isSafeInteger(blockIndex) || Number(blockIndex) < 0) return null;
  return {
    messageId: Number(messageId),
    mk,
    blockIndex: Number(blockIndex),
  };
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
  const batchState = inputs["era.batch.execution.state"].value;
  const consecutive = consecutiveFacts(batchState);
  const syncCursor = batchSyncCursor(batchState);
  const dispatchContext = isRecord(step.dispatchContext)
    ? step.dispatchContext
    : null;
  let variablesRaw: unknown = null;
  const messagesRaw =
    dispatchContext === null
      ? null
      : { schemaVersion: 2, messages: dispatchContext.messages };
  try {
    if (dispatchContext?.status !== "ready") {
      throw new TypeError(
        String(
          isRecord(dispatchContext?.failure)
            ? dispatchContext.failure.message
            : "统一派发上下文不可用。",
        ),
      );
    }
    // 此处只读取聊天中的 Sidecar 指针和旧状态迁移来源。后续 Nodeset 负责
    // 读取 V2 文件并以其状态替换 variablesRaw，生产同步不再直接读取 chat state。
    variablesRaw = await context.capabilities[
      "era.tavern.sidecar"
    ].read_current({});
    const result: SyncContextV1 = {
      schemaVersion: 1,
      step,
      consecutive,
      scopeWindow: (batchState as any).nextState.scopeWindow,
      syncCursor,
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
      consecutive,
      scopeWindow: (batchState as any).nextState.scopeWindow,
      syncCursor,
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
