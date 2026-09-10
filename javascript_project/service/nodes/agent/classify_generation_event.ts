import { classifyGeneration } from "../../base_lib/agent_flow_policy.ts";
import type { GenerationFacts } from "../../base_lib/agent_flow_types.ts";
export function run(inputs: Readonly<Record<string, unknown>>): any {
  return {
    generation_decision: classifyGeneration(
      (inputs["era.agent.generation.facts"] as { value: GenerationFacts })
        .value,
    ),
  };
}
