import { buildAgentTaskResult } from "../../base_lib/agent/agent_task_result.ts";
import type { AgentTransition } from "../../base_lib/agent/agent_flow_types.ts";
export function run(inputs: Readonly<Record<string, unknown>>): any {
  return {
    agent_task_result_direct: buildAgentTaskResult(
      (inputs["era.agent.session.transition"] as { value: AgentTransition })
        .value,
    ),
  };
}
