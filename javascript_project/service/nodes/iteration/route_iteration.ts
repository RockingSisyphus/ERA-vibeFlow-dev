import type { CollectionReductionV1 } from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.collection.reduction": Envelope<unknown>;
}>): any {
  const reduction = inputs["era.collection.reduction"].value as CollectionReductionV1;
  return { iteration_route: reduction.route };
}
