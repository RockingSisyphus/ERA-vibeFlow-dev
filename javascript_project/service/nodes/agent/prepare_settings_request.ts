import type { PlannedStepV1 } from "../../base_lib/service_types.ts";
import type { SettingsRequest } from "../../base_lib/agent/agent_flow_types.ts";
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
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
  if (
    step.kind !== "execute" ||
    step.task.primaryEvent.type !== "era.ui.agent_configuration"
  )
    throw new TypeError("设置流程只接受 Agent 设置命令。");
  let host: unknown = null;
  try {
    host = await runtime.capabilities["era.tavern.agent"].read_context({
      eventType: step.task.primaryEvent.type,
    });
  } catch {
    /* Preserve the original settings fallback after context acquisition fails. */
  }
  const arg = step.task.primaryEvent.args[0];
  const request: SettingsRequest = {
    command: arg?.kind === "json" ? arg.value : undefined,
    arguments: step.task.primaryEvent.args,
    context: isRecord(host)
      ? {
          configuration: host.configuration,
          identity: host.identity,
          session: host.session ?? null,
        }
      : null,
  };
  return { settings_request: request };
}
