// Adapters with identical declared base libraries share this source.
import { classifyGeneration, prepareGeneration } from "../../base_lib/agent/agent_flow_policy.ts";
import { type GenerationFacts, type GenerationDecision } from "../../base_lib/agent/agent_flow_types.ts";

// Original node: nodes/agent/classify_generation_event.ts
export function ClassifyGenerationEventNode(inputs: Readonly<Record<string, unknown>>): any {
  return {
    generation_decision: classifyGeneration(
      (inputs["era.agent.generation.facts"] as { value: GenerationFacts })
        .value,
    ),
  };
}

// Original node: nodes/agent/prepare_generation_phase.ts
export function PrepareGenerationPhaseNode(inputs: Readonly<Record<string, unknown>>): any {
  return {
    generation_request: prepareGeneration(
      (inputs["era.agent.generation.decision"] as { value: GenerationDecision })
        .value,
    ),
  };
}
