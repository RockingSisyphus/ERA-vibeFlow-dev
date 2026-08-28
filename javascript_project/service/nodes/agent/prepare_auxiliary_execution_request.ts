import {
  agentConfigurationVersion,
  normalizeAgentConfiguration,
} from "../../base_lib/agent_generation_session.ts";
import type { PlannedStepV1 } from "../../base_lib/service_types.ts";

interface Envelope<T> {
  readonly value: T;
}

interface Context {
  readonly capabilities: {
    readonly "era.tavern.agent": {
      read_context(input: Readonly<Record<string, unknown>>): Promise<unknown>;
    };
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function eventType(step: PlannedStepV1): string {
  if (step.kind !== "execute") return "";
  const value = step.task.primaryEvent.type;
  return typeof value === "string" ? value : "";
}

/**
 * 在阶段执行前只读取一次宿主事实，并把角色卡 V1/V2 配置归一化为无密钥 DTO。
 * URL 与密钥从不进入这个节点；自定义连接只保留本机方案引用。
 */
export async function run(
  inputs: Readonly<{
    "era.step.request.routed": Envelope<unknown>;
    "era.batch.execution.state": Envelope<unknown>;
  }>,
  _params: Readonly<Record<string, unknown>>,
  runtime: Context,
): Promise<any> {
  const step = inputs["era.step.request.routed"].value as PlannedStepV1;
  const executionState = inputs["era.batch.execution.state"].value;
  const diagnostics: Array<{ code: string; message: string }> = [];
  let hostContext: unknown = null;
  try {
    hostContext = await runtime.capabilities["era.tavern.agent"].read_context({
      eventType: eventType(step),
    });
  } catch (error) {
    diagnostics.push({
      code: "ERA_AGENT_CONTEXT_UNAVAILABLE",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  const rawConfiguration = isRecord(hostContext)
    ? hostContext.configuration
    : null;
  const configurationVersion = agentConfigurationVersion(rawConfiguration);
  const configuration = normalizeAgentConfiguration(rawConfiguration);
  return {
    agent_auxiliary_execution_request: {
      schemaVersion: 2,
      routedStep: step,
      executionState,
      hostContext,
      configurationVersion,
      migrationMode:
        configurationVersion === "1"
          ? "v1-preserved"
          : configurationVersion === "2"
            ? "v2"
            : "not-applicable",
      configuration,
      stages: [
        { stage: "planning", ...configuration.planning },
        { stage: "settlement", ...configuration.settlement },
      ],
      diagnostics,
    },
  };
}
