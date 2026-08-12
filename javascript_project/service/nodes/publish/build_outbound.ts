import {
  buildBatchResult,
  type BatchFinalizationV1,
} from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.batch.finalization": Envelope<unknown>;
}>): any {
  const result = buildBatchResult(
    inputs["era.batch.finalization"].value as BatchFinalizationV1,
  );
  return {
    batch_result_frame: result.frame,
    batch_fatal_flag: result.frame.fatal,
    post_batch_state: result.state,
  };
}
