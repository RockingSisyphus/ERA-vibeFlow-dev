import type { PlannedStepV1 } from "../../base_lib/service_types.ts";
interface Envelope<T> { readonly value: T; }
interface Transition { readonly step: PlannedStepV1; }
export function run(inputs: Readonly<{ "era.agent.session.transition": Envelope<unknown>; "era.batch.execution.state": Envelope<unknown> }>): any {
  const transition = inputs["era.agent.session.transition"].value as Transition;
  const executionState = inputs["era.batch.execution.state"].value;
  const step = transition.step;
  if (step.kind !== "execute") throw new TypeError("Agent 默认委托只接受 execute 步骤。");
  return { legacy_routed_step: { ...step, taskRoute: step.task.kind }, legacy_task_route: step.task.kind, legacy_execution_state: executionState };
}
