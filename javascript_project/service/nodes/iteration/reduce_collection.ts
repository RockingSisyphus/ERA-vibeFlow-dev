import {
  reduceForProtocolSlice,
  type EraServiceStateV1,
  type EraTransportEventV1,
} from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

interface Params {
  readonly _global?: Readonly<Record<string, unknown>>;
}

export function run(
  inputs: Readonly<{
    "era.service.state.current": Envelope<unknown>;
    "era.transport.event": Envelope<unknown>;
  }>,
  params: Params,
): any {
  const result = reduceForProtocolSlice(
    inputs["era.service.state.current"].value as EraServiceStateV1,
    inputs["era.transport.event"].value as EraTransportEventV1,
    params._global ?? {},
  );
  return {
    collection_reduction: result.reduction,
    collection_control: result.control,
  };
}
