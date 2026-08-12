import { buildNoHostOutcome, type DispatchSeedV1 } from "../../base_lib/dispatch_preparation.ts";
interface Envelope<T> { readonly value: T; }
export function run(inputs: Readonly<{ "era.dispatch.seed": Envelope<unknown> }>): any {
  return { no_host_outcome: buildNoHostOutcome(inputs["era.dispatch.seed"].value as DispatchSeedV1) };
}
