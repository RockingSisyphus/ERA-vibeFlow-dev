import { collectGenerationFacts } from "../../base_lib/agent_flow_policy.ts";
import type { PlannedStepV1 } from "../../base_lib/service_types.ts";
export async function run(
  inputs: Readonly<Record<string, unknown>>,
  _params: Readonly<Record<string, unknown>>,
  runtime: {
    capabilities: {
      "era.tavern.agent": {
        read_context(
          input: Readonly<Record<string, unknown>>,
        ): Promise<unknown>;
      };
    };
  },
): Promise<any> {
  const step = (inputs["era.step.request.routed"] as { value: PlannedStepV1 })
    .value;
  const diagnostics: { code: string; message: string }[] = [];
  let hostContext: unknown = null;
  try {
    hostContext = await runtime.capabilities["era.tavern.agent"].read_context({
      eventType: step.kind === "execute" ? step.task.primaryEvent.type : "",
    });
  } catch (error) {
    diagnostics.push({
      code: "ERA_AGENT_CONTEXT_UNAVAILABLE",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return {
    generation_facts: collectGenerationFacts(step, hostContext, diagnostics),
  };
}
