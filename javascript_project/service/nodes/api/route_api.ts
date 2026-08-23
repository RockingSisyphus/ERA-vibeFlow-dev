import type {
  BatchExecutionStateV1,
  PlannedStepV1,
} from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

type ApiRoute = "write" | "query" | "request-write-done" | "force-sync";

function classify(eventType: string): ApiRoute {
  switch (eventType) {
    case "era:insertByObject":
    case "era:updateByObject":
    case "era:insertByPath":
    case "era:updateByPath":
    case "era:deleteByObject":
    case "era:deleteByPath":
    case "era:functionInsertByObject":
    case "era:functionEditByObject":
    case "era:functionDeleteByObject":
      return "write";
    case "era:getCurrentVars":
    case "era:getSnapshotAtMk":
    case "era:getSnapshotsBetweenMks":
    case "era:getSnapshotAtMId":
    case "era:getSnapshotsBetweenMIds":
      return "query";
    case "era:requestWriteDone":
      return "request-write-done";
    case "era:forceSync":
      return "force-sync";
    default:
      throw new TypeError(`未登记的 ERA API 事件：${eventType}`);
  }
}

export function run(
  inputs: Readonly<{
    "era.step.request.routed": Envelope<unknown>;
    "era.batch.execution.state": Envelope<unknown>;
  }>,
): any {
  const step = inputs["era.step.request.routed"].value as PlannedStepV1;
  const executionState = inputs["era.batch.execution.state"]
    .value as BatchExecutionStateV1;
  if (step.kind !== "execute" || step.task.kind !== "api") {
    throw new TypeError("API 路由只接受携带完整 api task 的 execute 步骤");
  }
  if (step.sources.length === 0) throw new TypeError("API 步骤没有计划来源");

  const firstArg = step.task.args[0];
  const request: Record<string, unknown> = {
    task: step.task,
    sources: step.sources,
    dispatchContext: step.dispatchContext,
  };
  if (firstArg?.kind === "json") request.detail = firstArg.value;

  return {
    api_request: request,
    api_route: classify(step.task.eventType),
    api_execution_state: executionState,
  };
}
