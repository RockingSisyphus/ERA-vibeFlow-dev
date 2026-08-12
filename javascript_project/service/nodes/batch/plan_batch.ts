import {
  planProtocolBatch,
  type CollectionReductionV1,
} from "../../base_lib/service_protocol.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(inputs: Readonly<{
  "era.collection.reduction": Envelope<unknown>;
}>): any {
  return {
    batch_plan: planProtocolBatch(
      inputs["era.collection.reduction"].value as CollectionReductionV1,
    ),
  };
}
