import type { EraServiceStateV1 } from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.service.state": Envelope<unknown>;
}>): any {
  return {
    service_state_current: inputs["era.service.state"].value as EraServiceStateV1,
  };
}
