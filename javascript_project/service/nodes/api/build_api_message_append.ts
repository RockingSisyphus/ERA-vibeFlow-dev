import {
  planApiMessageAppend,
  type EraApiWriteDirectiveV1,
} from "../../base_lib/domain/api_write_engine.ts";

interface Envelope<T> {
  readonly value: T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unwrapRead(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.ok === false) {
    const error = isRecord(value.error) ? value.error : {};
    throw new Error(String(error.message ?? "读取写入目标消息失败。"));
  }
  return value.ok === true && Object.prototype.hasOwnProperty.call(value, "value")
    ? value.value
    : value;
}

export function run(
  inputs: Readonly<{
    "era.api.write.directive": Envelope<unknown>;
    "era.tavern.messages.read_context.outcome": Envelope<unknown>;
  }>,
): any {
  const carried = inputs["era.api.write.directive"].value;
  if (!isRecord(carried) || !isRecord(carried.directive)) {
    throw new TypeError("写入 API 指令上下文损坏。");
  }
  const plan = planApiMessageAppend(
    unwrapRead(inputs["era.tavern.messages.read_context.outcome"].value),
    carried.directive as unknown as EraApiWriteDirectiveV1,
  );
  return {
    api_message_append_request: {
      request: carried.request,
      directive: carried.directive,
      plan,
      capabilityInput: {
        messageId: plan.messageId,
        content: plan.newContent,
        refresh: "affected",
        purpose: "era-api-message-write",
      },
    },
  };
}
