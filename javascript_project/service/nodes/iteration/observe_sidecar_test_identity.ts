import {
  observeSidecarTestIdentity,
  type EraTransportEventV1,
} from "../../base_lib/sidecar_identity.ts";

interface Envelope<T> {
  readonly value: T;
}

interface Context {
  readonly capabilities: {
    readonly "era.tavern.sidecar_test": {
      readonly read_context: (input: Readonly<Record<string, unknown>>) => Promise<unknown>;
      readonly publish_report: (input: Readonly<Record<string, unknown>>) => unknown;
    };
  };
}

/**
 * The test-only observer is deliberately transparent to the event collection.
 * A missing fixture or failed observation must never change production routing.
 */
export async function run(
  inputs: Readonly<{ "era.transport.event": Envelope<unknown> }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  const transportEvent = inputs["era.transport.event"].value as EraTransportEventV1;
  try {
    const raw = await context.capabilities["era.tavern.sidecar_test"].read_context({
      purpose: "era-sidecar-test-identity",
    });
    const report = observeSidecarTestIdentity(raw, transportEvent);
    if (report !== null) {
      context.capabilities["era.tavern.sidecar_test"].publish_report({ report });
    }
  } catch {
    // This optional test probe cannot perturb FIFO, synchronization or normal
    // Tavern behavior. Missing evidence remains visible to the Pack evaluator.
  }
  return { sidecar_transport_event: transportEvent };
}
