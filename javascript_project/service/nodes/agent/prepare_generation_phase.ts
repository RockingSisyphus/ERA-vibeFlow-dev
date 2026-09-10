import { prepareGeneration } from "../../base_lib/agent_flow_policy.ts";
import type { GenerationDecision } from "../../base_lib/agent_flow_types.ts";
export function run(inputs: Readonly<Record<string, unknown>>): any {
  return {
    generation_request: prepareGeneration(
      (inputs["era.agent.generation.decision"] as { value: GenerationDecision })
        .value,
    ),
  };
}
