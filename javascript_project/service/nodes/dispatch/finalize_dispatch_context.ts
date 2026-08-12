import { dispatchContextOf, type DispatchPreparationOutcomeV1 } from "../../base_lib/dispatch_preparation.ts";
interface Envelope<T> { readonly value: T; }
export function run(inputs: Readonly<{ "era.dispatch.preparation.outcome": Envelope<unknown> }>): any {
  const outcome = inputs["era.dispatch.preparation.outcome"].value as DispatchPreparationOutcomeV1;
  return {
    prepared_routed_step: { ...outcome.seed.step, dispatchContext: dispatchContextOf(outcome) },
    prepared_task_route: outcome.seed.dispatchClass,
    prepared_execution_state: outcome.seed.state,
  };
}
