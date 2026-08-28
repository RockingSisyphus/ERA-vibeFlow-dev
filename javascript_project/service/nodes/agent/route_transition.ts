interface Envelope<T> { readonly value: T; }
interface Transition { readonly mode: "legacy" | "legacy-ignore" | "execute-legacy" | "execute-only"; }
export function run(inputs: Readonly<{ "era.agent.session.transition": Envelope<unknown>; "era.batch.execution.state": Envelope<unknown> }>): any {
  const transition = inputs["era.agent.session.transition"].value as Transition;
  const executionState = inputs["era.batch.execution.state"].value;
  const agent_route =
      transition.mode === "legacy" || transition.mode === "execute-legacy"
        ? "legacy"
        : "direct";
  return { agent_route, agent_transition_routed: transition, agent_execution_state_routed: executionState };
}
