import type { PlannedStepV1 } from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.step.request": Envelope<unknown>;
}>): any {
  const step = inputs["era.step.request"].value as PlannedStepV1;
  return { routed_step: step, task_route: step.taskRoute };
}
