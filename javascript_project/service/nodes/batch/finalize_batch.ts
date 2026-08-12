import {
  finalizeBatch,
  type BatchExecutionStateV1,
} from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.batch.execution.state.after": Envelope<unknown>;
}>): any {
  return {
    batch_finalization: finalizeBatch(
      inputs["era.batch.execution.state.after"].value as BatchExecutionStateV1,
    ),
  };
}
