interface Envelope<T> {
  readonly value: T;
}

type QueryRoute =
  | "get-current-vars"
  | "get-snapshot-at-mk"
  | "get-snapshots-between-mks"
  | "get-snapshot-at-mid"
  | "get-snapshots-between-mids";

function route(eventType: unknown): QueryRoute {
  switch (eventType) {
    case "era:getCurrentVars":
      return "get-current-vars";
    case "era:getSnapshotAtMk":
      return "get-snapshot-at-mk";
    case "era:getSnapshotsBetweenMks":
      return "get-snapshots-between-mks";
    case "era:getSnapshotAtMId":
      return "get-snapshot-at-mid";
    case "era:getSnapshotsBetweenMIds":
      return "get-snapshots-between-mids";
    default:
      throw new TypeError(`未登记的 ERA 查询事件：${String(eventType)}`);
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("规范化 API 查询请求必须是对象");
  }
  return value as Readonly<Record<string, unknown>>;
}

export function run(
  inputs: Readonly<{
    "era.api.request": Envelope<unknown>;
  }>,
): any {
  const request = record(inputs["era.api.request"].value);
  const task = record(request.task);
  if (task.kind !== "api")
    throw new TypeError("查询请求没有 canonical api task");
  return {
    query_request: { ...request },
    query_route: route(task.eventType),
  };
}
