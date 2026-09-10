import { buildAgentTaskResult } from "../../base_lib/agent_task_result.ts";
import type { AgentOutcome } from "../../base_lib/agent_flow_types.ts";
import type { PlannedStepV1 } from "../../base_lib/service_types.ts";
export function run(inputs: Readonly<Record<string, unknown>>): any {
  const step = (inputs["era.step.request.routed"] as { value: PlannedStepV1 })
    .value;
  const outcome = (
    inputs["era.agent.settings.outcome"] as { value: AgentOutcome }
  ).value;
  return {
    settings_result: buildAgentTaskResult({
      schemaVersion: 1,
      step,
      ...outcome,
    }),
  };
}
