interface Envelope<T> {
  readonly value: T;
}

type WriteRoute =
  | "insert-by-object"
  | "update-by-object"
  | "insert-by-path"
  | "update-by-path"
  | "delete-by-object"
  | "delete-by-path";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function routeOf(eventType: string): WriteRoute {
  switch (eventType) {
    case "era:insertByObject":
      return "insert-by-object";
    case "era:updateByObject":
      return "update-by-object";
    case "era:insertByPath":
      return "insert-by-path";
    case "era:updateByPath":
      return "update-by-path";
    case "era:deleteByObject":
      return "delete-by-object";
    case "era:deleteByPath":
      return "delete-by-path";
    default:
      throw new TypeError(`不是已登记的 ERA 写入 API：${eventType}`);
  }
}

export function run(
  inputs: Readonly<{ "era.api.request": Envelope<unknown> }>,
): any {
  const request = inputs["era.api.request"].value;
  if (!isRecord(request) || !isRecord(request.task)) {
    throw new TypeError("写入 API 请求缺少完整 task。");
  }
  const eventType = String(request.task.eventType ?? "");
  return {
    write_request: request,
    write_route: routeOf(eventType),
  };
}
