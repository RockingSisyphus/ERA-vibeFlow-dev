interface Envelope<T> {
  readonly value: T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function run(
  inputs: Readonly<{ "era.api.write.append.result": Envelope<unknown> }>,
): any {
  const result = inputs["era.api.write.append.result"].value;
  if (!isRecord(result)) throw new TypeError("消息追加结果损坏。");
  const status = result.status;
  if (status !== "committed" && status !== "failed" && status !== "unknown") {
    throw new TypeError(`消息追加状态无效：${String(status)}`);
  }
  return {
    api_message_append_routed: result,
    api_message_append_route:
      status === "committed" ? "sync" : status === "failed" ? "failed" : "fatal",
  };
}
