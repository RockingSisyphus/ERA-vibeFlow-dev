import {
  mergeTaskResult,
  type BatchExecutionStateV1,
  type TaskResultV1,
} from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.batch.execution.state": Envelope<unknown>;
  "era.task.result": Envelope<unknown>;
}>): any {
  const result = mergeTaskResult(
    inputs["era.batch.execution.state"].value as BatchExecutionStateV1,
    inputs["era.task.result"].value as TaskResultV1,
  );
  return {
    execution_state_next: result.state,
    step_done: result.done,
  };
}
