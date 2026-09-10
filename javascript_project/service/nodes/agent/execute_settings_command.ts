import { configurationWithPendingConnections } from "../../base_lib/agent_settings_policy.ts";
import {
  connectionId,
  planConnectionSave,
  planConnectionDelete,
  planConnectionClear,
  type ConnectionState,
} from "../../base_lib/agent_connection_policy.ts";
import {
  agentPresetName,
  captureAgentPresetSnapshot,
} from "../../base_lib/agent_request_policy.ts";
import { normalizeAgentConfiguration } from "../../base_lib/agent_generation_session.ts";
import type {
  SettingsRequest,
  AgentOutcome,
} from "../../base_lib/agent_flow_types.ts";
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isGroupChat(context: Record<string, unknown>): boolean {
  const identity = isRecord(context.identity) ? context.identity : {};
  return typeof identity.groupId === "string" && identity.groupId.length > 0;
}

function saveConnection(
  capability: SettingsCapability,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const state = capability.read_connection_state({
    id: connectionId(input.id),
  });
  const plan = planConnectionSave(input, state);
  return capability.upsert_connection_profile({
    ...plan,
    keyReference: input.keyReference,
  });
}
interface SettingsCapability {
  read_connection_state(
    input: Readonly<Record<string, unknown>>,
  ): ConnectionState;
  read_configuration_sources(input: Readonly<Record<string, unknown>>): unknown;
  capture_preset(input: Readonly<Record<string, unknown>>): unknown;
  write_configuration(
    input: Readonly<Record<string, unknown>>,
  ): Promise<unknown>;
  upsert_connection_profile(
    input: Readonly<Record<string, unknown>>,
  ): Promise<unknown>;
  delete_connection_profile(
    input: Readonly<Record<string, unknown>>,
  ): Promise<unknown>;
  clear_connection_profile_key(
    input: Readonly<Record<string, unknown>>,
  ): Promise<unknown>;
  list_connection_models(
    input: Readonly<Record<string, unknown>>,
  ): Promise<unknown>;
  list_connection_models_draft(
    input: Readonly<Record<string, unknown>>,
  ): Promise<unknown>;
}
function settingsOutcome(
  status: AgentOutcome["status"],
  diagnostics: AgentOutcome["diagnostics"] = [],
  value?: unknown,
): AgentOutcome {
  return {
    mode: "execute-only",
    status,
    diagnostics,
    ...(value === undefined ? {} : { value }),
  };
}
export async function run(
  inputs: Readonly<Record<string, unknown>>,
  _params: Readonly<Record<string, unknown>>,
  runtime: { capabilities: { "era.tavern.agent": SettingsCapability } },
): Promise<any> {
  const request = (
    inputs["era.agent.settings.request"] as { value: SettingsRequest }
  ).value;
  const capability = runtime.capabilities["era.tavern.agent"];
  const output = (settings_outcome: AgentOutcome) => ({ settings_outcome });
  const payload = request.command;
  if (!isRecord(payload))
    return output(
      settingsOutcome("failed", [
        { code: "ERA_AGENT_CONFIG_INVALID", message: "配置请求缺少对象。" },
      ]),
    );
  if (payload.action === "read") {
    const rawContext = request.context;
    const configuration = normalizeAgentConfiguration(
      isRecord(rawContext) ? rawContext.configuration : null,
    );
    const sources = capability.read_configuration_sources({});
    return output(
      settingsOutcome("committed", [], {
        configuration,
        groupChat: isRecord(rawContext) && isGroupChat(rawContext),
        session: isRecord(rawContext) ? (rawContext.session ?? null) : null,
        sources,
      }),
    );
  }
  if (payload.action === "read-sources") {
    return output(
      settingsOutcome("committed", [], {
        sources: capability.read_configuration_sources({}),
      }),
    );
  }
  if (payload.action === "capture-preset") {
    try {
      const preset = captureAgentPresetSnapshot(
        capability.capture_preset({ name: agentPresetName(payload.name) }),
      );
      return output(settingsOutcome("committed", [], { preset }));
    } catch (error) {
      return output(
        settingsOutcome("failed", [
          {
            code: "ERA_AGENT_PRESET_CAPTURE_FAILED",
            message: failureMessage(error),
          },
        ]),
      );
    }
  }
  if (payload.action === "upsert-connection-profile") {
    try {
      const result = await saveConnection(
        capability,
        isRecord(payload.profile) ? payload.profile : {},
      );
      return output(
        settingsOutcome("committed", [], {
          result,
          sources: capability.read_configuration_sources({}),
        }),
      );
    } catch (error) {
      return output(
        settingsOutcome("failed", [
          {
            code: "ERA_AGENT_PROFILE_WRITE_FAILED",
            message: failureMessage(error),
          },
        ]),
      );
    }
  }
  if (payload.action === "delete-connection-profile") {
    try {
      const state = capability.read_connection_state({
        id: connectionId(payload.id),
      });
      const result = await capability.delete_connection_profile(
        planConnectionDelete(payload.id, state),
      );
      return output(
        settingsOutcome("committed", [], {
          result,
          sources: capability.read_configuration_sources({}),
        }),
      );
    } catch (error) {
      return output(
        settingsOutcome("failed", [
          {
            code: "ERA_AGENT_PROFILE_DELETE_FAILED",
            message: failureMessage(error),
          },
        ]),
      );
    }
  }
  if (payload.action === "clear-connection-profile-key") {
    try {
      const state = capability.read_connection_state({
        id: connectionId(payload.id),
      });
      const result = await capability.clear_connection_profile_key(
        planConnectionClear(state),
      );
      return output(
        settingsOutcome("committed", [], {
          result,
          sources: capability.read_configuration_sources({}),
        }),
      );
    } catch (error) {
      return output(
        settingsOutcome("failed", [
          {
            code: "ERA_AGENT_PROFILE_KEY_CLEAR_FAILED",
            message: failureMessage(error),
          },
        ]),
      );
    }
  }
  if (payload.action === "list-connection-models") {
    try {
      const result = await capability.list_connection_models({
        id: payload.id,
      });
      return output(settingsOutcome("committed", [], { result }));
    } catch (error) {
      return output(
        settingsOutcome("failed", [
          {
            code: "ERA_AGENT_MODEL_LIST_FAILED",
            message: failureMessage(error),
          },
        ]),
      );
    }
  }
  if (payload.action === "list-connection-models-draft") {
    try {
      const keyArgIndex = Number(payload.keyArgIndex);
      const result = await capability.list_connection_models_draft({
        apiUrl: payload.apiUrl,
        ...(Number.isSafeInteger(keyArgIndex) && keyArgIndex > 0
          ? { keyReference: request.arguments[keyArgIndex] }
          : {}),
      });
      return output(settingsOutcome("committed", [], { result }));
    } catch (error) {
      return output(
        settingsOutcome("failed", [
          {
            code: "ERA_AGENT_MODEL_LIST_FAILED",
            message: failureMessage(error),
          },
        ]),
      );
    }
  }
  if (payload.action === "write-with-connections") {
    try {
      const configuration = configurationWithPendingConnections(
        payload.configuration,
      );
      const mutations = Array.isArray(payload.connectionMutations)
        ? payload.connectionMutations.filter(isRecord).slice(0, 34)
        : [];
      const signatures = new Map<string, string>();
      const results = new Map<string, unknown>();

      // 必须在第一次宿主写入前完整验证草稿表和共享方案冲突，
      // 否则后续无效草稿会在总保存失败时留下本不应发生的前缀写入。
      for (const mutation of mutations) {
        const stage = mutation.stage;
        const index = Number(mutation.index);
        if (
          (stage !== "planning" && stage !== "settlement") ||
          !Number.isSafeInteger(index) ||
          index < 0
        ) {
          throw new TypeError("连接草稿缺少合法阶段或尝试序号。");
        }
        const attempt = configuration[stage].attempts[index];
        if (!attempt || attempt.modelSource.kind !== "custom-profile") {
          throw new TypeError("连接草稿目标不是自定义 API 尝试。");
        }
        const existingId =
          typeof mutation.id === "string" && mutation.id.length > 0
            ? mutation.id
            : "";
        const keyArgIndex = Number(mutation.keyArgIndex);
        const signature = JSON.stringify({
          name: mutation.name,
          apiUrl: mutation.apiUrl,
          clearKey: mutation.clearKey === true,
          hasKey: Number.isSafeInteger(keyArgIndex) && keyArgIndex > 0,
        });
        if (existingId) {
          const previous = signatures.get(existingId);
          if (previous !== undefined && previous !== signature) {
            throw new TypeError(
              `同一本机方案 ${existingId} 被多个尝试以冲突内容修改；请将其中一项另存为。`,
            );
          }
          signatures.set(existingId, signature);
        }
      }

      for (const mutation of mutations) {
        const stage = mutation.stage as "planning" | "settlement";
        const index = Number(mutation.index);
        const attempt = configuration[stage].attempts[index]!;
        const existingId =
          typeof mutation.id === "string" && mutation.id.length > 0
            ? mutation.id
            : "";
        const keyArgIndex = Number(mutation.keyArgIndex);
        const signature = JSON.stringify({
          name: mutation.name,
          apiUrl: mutation.apiUrl,
          clearKey: mutation.clearKey === true,
          hasKey: Number.isSafeInteger(keyArgIndex) && keyArgIndex > 0,
        });

        let result = existingId
          ? results.get(`${existingId}:${signature}`)
          : undefined;
        if (result === undefined) {
          result = await saveConnection(capability, {
            ...(existingId ? { id: existingId } : {}),
            name: mutation.name,
            apiUrl: mutation.apiUrl,
            clearKey: mutation.clearKey === true,
            ...(Number.isSafeInteger(keyArgIndex) && keyArgIndex > 0
              ? { keyReference: request.arguments[keyArgIndex] }
              : {}),
          });
          if (existingId) results.set(`${existingId}:${signature}`, result);
        }
        const summary =
          isRecord(result) && isRecord(result.profile) ? result.profile : null;
        if (
          !summary ||
          typeof summary.id !== "string" ||
          typeof summary.name !== "string"
        ) {
          throw new TypeError("Host 未返回已保存连接方案的脱敏摘要。");
        }
        attempt.modelSource.profileId = summary.id;
        attempt.modelSource.profileNameHint = summary.name;
      }

      for (const stageName of ["planning", "settlement"] as const) {
        for (const [index, attempt] of configuration[
          stageName
        ].attempts.entries()) {
          if (
            attempt.modelSource.kind === "custom-profile" &&
            !attempt.modelSource.profileId
          ) {
            throw new TypeError(
              `${stageName} 尝试 ${index + 1} 的自定义 API 方案尚未保存或绑定。`,
            );
          }
        }
      }

      const normalized = normalizeAgentConfiguration(configuration);
      await capability.write_configuration({ configuration: normalized });
      return output(
        settingsOutcome("committed", [], {
          configuration: normalized,
          sources: capability.read_configuration_sources({}),
        }),
      );
    } catch (error) {
      return output(
        settingsOutcome("failed", [
          {
            code: "ERA_AGENT_CONFIGURATION_SAVE_FAILED",
            message: failureMessage(error),
          },
        ]),
      );
    }
  }
  const configuration = normalizeAgentConfiguration(payload.configuration);
  await capability.write_configuration({ configuration });
  return output(settingsOutcome("committed", [], { configuration }));
}
