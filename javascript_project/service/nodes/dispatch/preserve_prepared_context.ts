import { preserveDispatchPreparation, type DispatchPreparationPlanV1 } from "../../base_lib/dispatch_preparation.ts";
interface Envelope<T> { readonly value: T; }
export function run(inputs: Readonly<{ "era.dispatch.preparation.plan": Envelope<unknown> }>): any {
  return { preserved_preparation_outcome: preserveDispatchPreparation(inputs["era.dispatch.preparation.plan"].value as DispatchPreparationPlanV1) };
}
