import { planDispatchPreparation, type DispatchCanonicalContextV1 } from "../../base_lib/dispatch_preparation.ts";
interface Envelope<T> { readonly value: T; }
export function run(inputs: Readonly<{ "era.dispatch.canonical_context": Envelope<unknown> }>): any {
  const plan = planDispatchPreparation(inputs["era.dispatch.canonical_context"].value as DispatchCanonicalContextV1);
  return {
    dispatch_preparation_plan: plan,
    precommit_route: plan.status === "ready" && (plan.messageWriteRequired || plan.variableWriteRequired) ? "commit" : "no-op",
  };
}
