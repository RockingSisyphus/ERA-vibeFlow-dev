import type { BatchExecutionStateV1 } from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(
  inputs: Readonly<{
    "era.api.request": Envelope<unknown>;
    "era.batch.execution.state": Envelope<unknown>;
  }>,
): any {
  return {
    api_context_request: inputs["era.api.request"].value as Readonly<
      Record<string, unknown>
    >,
    api_context_state: inputs["era.batch.execution.state"]
      .value as BatchExecutionStateV1,
  };
}
