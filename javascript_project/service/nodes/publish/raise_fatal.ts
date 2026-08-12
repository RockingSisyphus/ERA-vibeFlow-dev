import type { EraServiceStateV1 } from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(_inputs: Readonly<{
  "era.service.state.post_batch": Envelope<unknown>;
}>): { readonly fatal_state_next: EraServiceStateV1 } {
  throw new Error("ERA_SERVICE_FATAL_AFTER_BATCH_RESULT");
}
