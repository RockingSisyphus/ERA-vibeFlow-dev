import { classifyDispatch } from "../../base_lib/dispatch_preparation.ts";
import type { BatchExecutionStateV1, PlannedStepV1 } from "../../base_lib/service_types.ts";

interface Envelope<T> { readonly value: T; }

export function run(inputs: Readonly<{
  "era.step.request": Envelope<unknown>;
  "era.batch.execution.state": Envelope<unknown>;
}>): any {
  const { seed, route } = classifyDispatch(
    inputs["era.step.request"].value as PlannedStepV1,
    inputs["era.batch.execution.state"].value as BatchExecutionStateV1,
  );
  return { dispatch_seed: seed, context_route: route };
}
