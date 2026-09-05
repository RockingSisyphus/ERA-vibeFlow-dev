import type { PlannedStepV1 } from "../../base_lib/service_types.ts";
interface Envelope<T> { readonly value: T; }
interface Transition { readonly step: PlannedStepV1; }
export function run(inputs: Readonly<{ "era.agent.session.transition": Envelope<unknown>; "era.batch.execution.state": Envelope<unknown> }>): any {
  const transition = inputs["era.agent.session.transition"].value as Transition;
  const executionState = inputs["era.batch.execution.state"].value;
  const step = transition.step;
  if (step.kind !== "execute") throw new TypeError("Agent 默认委托只接受 execute 步骤。");
  const context = step.dispatchContext;
  const hasFloorCandidate = context !== null
    && typeof context === "object"
    && !Array.isArray(context)
    && (context as Readonly<Record<string, unknown>>).schemaVersion === 3
    && (context as Readonly<Record<string, unknown>>).agentFloorCandidate !== null;
  if (hasFloorCandidate && step.task.kind !== "sync") {
    const task = {
      id: step.task.id,
      kind: "sync" as const,
      sourceEvents: step.task.sourceEvents,
      primaryEvent: step.task.primaryEvent,
      context: "latest-message-with-mk" as const,
      reason: "manual" as const,
      target: { kind: "auto" as const },
      fullRebuild: false,
    };
    return {
      legacy_routed_step: { ...step, task, taskRoute: "sync" },
      legacy_task_route: "sync",
      legacy_execution_state: executionState,
    };
  }
  return { legacy_routed_step: { ...step, taskRoute: step.task.kind }, legacy_task_route: step.task.kind, legacy_execution_state: executionState };
}
