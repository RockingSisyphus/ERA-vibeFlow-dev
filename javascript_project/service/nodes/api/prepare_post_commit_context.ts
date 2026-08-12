import {
  cloneEraPortableJsonV1,
  isEraDispatchContextV2,
  isEraTavernMessageContextV2,
  type EraFailureV1
} from "@era/vibeflow-contracts";

interface Envelope<T> {
  readonly value: T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function failure(code: string, message: string): EraFailureV1 {
  return { code, message, category: "tavern", retryable: false };
}

function failed(appendResult: Record<string, unknown>, value: EraFailureV1) {
  return {
    post_commit_context_route: "fatal",
    post_commit_sync_context: null,
    post_commit_context_failure: {
      schemaVersion: 1,
      appendResult,
      failure: value
    }
  };
}

export function run(
  inputs: Readonly<{
    "era.api.write.append.result": Envelope<unknown>;
    "era.tavern.messages.read_context.outcome": Envelope<unknown>;
  }>
): any {
  const appendResult = inputs["era.api.write.append.result"].value;
  if (
    !isRecord(appendResult) ||
    appendResult.status !== "committed" ||
    !isRecord(appendResult.request)
  ) {
    throw new TypeError("提交后上下文缺少已确认消息追加结果。");
  }
  const read = inputs["era.tavern.messages.read_context.outcome"].value;
  if (!isRecord(read) || read.ok !== true) {
    const error = isRecord(read) && isRecord(read.error) ? read.error : {};
    return failed(
      appendResult,
      failure(
        String(error.code ?? "ERA_API_POST_COMMIT_READ_FAILED"),
        String(error.message ?? "消息已提交，但无法读取提交后消息快照。")
      )
    );
  }
  if (!isEraTavernMessageContextV2(read.value)) {
    return failed(
      appendResult,
      failure(
        "ERA_API_POST_COMMIT_CONTEXT_INVALID",
        "提交后消息读取未返回严格消息上下文。"
      )
    );
  }
  const appendRequest = appendResult.request;
  const carried = isRecord(appendRequest.request)
    ? appendRequest.request
    : null;
  const plan = isRecord(appendRequest.plan) ? appendRequest.plan : null;
  const dispatchContext = carried?.dispatchContext;
  if (
    carried === null ||
    plan === null ||
    !isEraDispatchContextV2(dispatchContext)
  ) {
    return failed(
      appendResult,
      failure(
        "ERA_API_POST_COMMIT_IDENTITY_INVALID",
        "消息已提交，但原 API 处理身份或追加计划损坏。"
      )
    );
  }
  const messageId = plan.messageId;
  const newContent = plan.newContent;
  if (
    !Number.isSafeInteger(messageId) ||
    Number(messageId) < 0 ||
    typeof newContent !== "string"
  ) {
    return failed(
      appendResult,
      failure(
        "ERA_API_POST_COMMIT_TARGET_INVALID",
        "消息已提交，但追加计划缺少有效目标或文本。"
      )
    );
  }
  const matches = read.value.messages.filter(
    (message) => message.messageId === Number(messageId)
  );
  if (matches.length !== 1) {
    return failed(
      appendResult,
      failure(
        "ERA_API_POST_COMMIT_TARGET_AMBIGUOUS",
        `提交后快照必须唯一包含目标消息，实际命中 ${matches.length} 条。`
      )
    );
  }
  if (matches[0].activeText !== newContent) {
    return failed(
      appendResult,
      failure(
        "ERA_API_POST_COMMIT_TEXT_MISMATCH",
        "提交后目标消息文本与已确认写入内容不一致。"
      )
    );
  }
  const nextDispatchContext = {
    ...dispatchContext,
    messages: cloneEraPortableJsonV1(read.value.messages)
  };
  if (!isEraDispatchContextV2(nextDispatchContext)) {
    return failed(
      appendResult,
      failure(
        "ERA_API_POST_COMMIT_CONTEXT_INVALID",
        "提交后严格消息快照无法形成有效派发上下文。"
      )
    );
  }
  return {
    post_commit_context_route: "ready",
    post_commit_sync_context: {
      schemaVersion: 1,
      appendResult,
      dispatchContext: nextDispatchContext
    },
    post_commit_context_failure: null
  };
}
