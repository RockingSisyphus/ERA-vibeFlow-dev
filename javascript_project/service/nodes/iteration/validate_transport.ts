import { validateTransportEvent } from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

interface Params {
  readonly _global?: Readonly<Record<string, unknown>>;
}

export function run(
  inputs: Readonly<{ "era.transport.event.raw": Envelope<unknown> }>,
  params: Params,
): any {
  return {
    transport_event: validateTransportEvent(
      inputs["era.transport.event.raw"].value,
      params._global ?? {},
    ),
  };
}
