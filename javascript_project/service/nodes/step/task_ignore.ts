import {
  createProtocolIgnoreResult,
  type PlannedStepV1,
} from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(
  inputs: Readonly<{
    "era.step.request.routed": Envelope<unknown>;
  }>,
): any {
  const step = inputs["era.step.request.routed"].value as PlannedStepV1;
  if (step.kind !== "ignore") {
    throw new TypeError("忽略任务节点只接受 kind=ignore 的严格步骤");
  }
  return { ignore_task_result: createProtocolIgnoreResult(step) };
}
