import {
  createExecutionState,
  type BatchPlanV1,
} from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.batch.plan": Envelope<unknown>;
}>): any {
  const result = createExecutionState(
    inputs["era.batch.plan"].value as BatchPlanV1,
  );
  return {
    coverage_route: result.route,
    execution_state: result.state,
  };
}
