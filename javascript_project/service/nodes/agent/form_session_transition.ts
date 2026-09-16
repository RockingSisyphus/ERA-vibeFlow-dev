import {
  withFloorCandidate,
  AgentSessionFailure,
} from "../../base_lib/agent_flow_policy.ts";
import type { AgentOutcome } from "../../base_lib/agent_flow_types.ts";
import type { PlannedStepV1 } from "../../base_lib/service_types.ts";
export function run(inputs: Readonly<Record<string, unknown>>): any {
  const original = (
    inputs["era.step.request.routed"] as { value: PlannedStepV1 }
  ).value;
  const { candidate, appliedFloor, appliedScopeWindow, ...outcome } = (
    inputs["era.agent.generation.outcome"] as { value: AgentOutcome }
  ).value;
  let step = original,
    result = outcome;
  try {
    if (candidate) step = withFloorCandidate(original, candidate, appliedFloor);
  } catch (error) {
    result = {
      mode: "execute-only",
      status: "failed",
      diagnostics: [
        {
          code:
            error instanceof AgentSessionFailure
              ? error.code
              : "ERA_AGENT_SESSION_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
  const execution = (inputs["era.batch.execution.state"] as { value: any })
    .value;
  return {
    agent_transition: { schemaVersion: 1, step, ...result },
    agent_execution_state: appliedScopeWindow
      ? {
          ...execution,
          nextState: {
            ...execution.nextState,
            scopeWindow: appliedScopeWindow,
          },
        }
      : execution,
  };
}
