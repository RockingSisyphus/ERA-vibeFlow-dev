import {
  failCoverage,
  type BatchExecutionStateV1,
} from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.batch.execution.state": Envelope<unknown>;
}>): any {
  return {
    coverage_failure_state: failCoverage(
      inputs["era.batch.execution.state"].value as BatchExecutionStateV1,
    ),
  };
}
