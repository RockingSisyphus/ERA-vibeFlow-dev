import {
  selectCurrentStep,
  type BatchExecutionStateV1,
} from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.batch.execution.state": Envelope<unknown>;
}>): any {
  const state = inputs["era.batch.execution.state"].value as BatchExecutionStateV1;
  return {
    selected_step: selectCurrentStep(state),
    execution_state_for_merge: state,
  };
}
