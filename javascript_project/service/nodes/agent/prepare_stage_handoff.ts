import { stageHandoff } from "../../base_lib/agent_stage_handoff.ts";
import type { AgentOutcome } from "../../base_lib/agent_flow_types.ts";
export function run(inputs: Readonly<Record<string, unknown>>): any {
  const outcome = (
    inputs["era.agent.candidate.outcome"] as { value: AgentOutcome }
  ).value;
  if (!outcome.stageBoundary) return { handoff_outcome: outcome };
  const { stageBoundary, ...rest } = outcome;
  const handoff = stageHandoff(stageBoundary);
  return {
    handoff_outcome: {
      ...rest,
      handoff,
      value: { status: "stage-pending", completionId: handoff.completionId },
    },
  };
}
