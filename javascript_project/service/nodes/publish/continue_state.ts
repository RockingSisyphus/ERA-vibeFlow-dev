import type { EraServiceStateV1 } from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.service.state.post_batch": Envelope<unknown>;
}>): any {
  return {
    continued_state_next:
      inputs["era.service.state.post_batch"].value as EraServiceStateV1,
  };
}
