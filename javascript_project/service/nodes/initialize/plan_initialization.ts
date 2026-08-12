import { planInitialization, type InitializationContextV1 } from "../../base_lib/initialization_transaction.ts";
interface Envelope<T> { readonly value: T; }
export function run(inputs: Readonly<{ "era.initialize.context": Envelope<unknown> }>): any {
  const plan = planInitialization(inputs["era.initialize.context"].value as InitializationContextV1);
  const route: "no-op" | "reconcile" = plan.actions.length === 0 ? "no-op" : "reconcile";
  return { initialization_route: route, initialization_plan: plan as unknown as Readonly<Record<string, unknown>> };
}
