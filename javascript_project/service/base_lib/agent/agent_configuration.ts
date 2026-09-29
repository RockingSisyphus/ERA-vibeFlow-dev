export interface EraAgentRequestContext {
  readonly executionId: string;
  readonly trigger: string;
  readonly attemptIndex: number;
  readonly intent: "initial" | "correction" | "request-retry";
  readonly previousRequestId?: string;
}

export type EraAgentStage = "planning" | "settlement";
/** Agent configuration contracts and normalization, independent of stage execution. */
import type { JsonValue } from "@era/vibeflow-contracts";
export const ERA_AGENT_SCHEMA_VERSION = "2" as const;
export const ERA_AGENT_MAX_RETRIES = 16;

export interface EraAgentRolePromptV1 {
  readonly role: "system" | "assistant" | "user";
  readonly content: string;
}

export interface EraAgentPresetSnapshotV1 {
  readonly source: "snapshot";
  readonly orderedPrompts: readonly (
    | "world_info_before"
    | "persona_description"
    | "char_description"
    | "char_personality"
    | "scenario"
    | "world_info_after"
    | "dialogue_examples"
    | "chat_history"
    | "user_input"
    | EraAgentRolePromptV1
  )[];
  readonly settings?: Readonly<{
    maxTokens?: number;
    temperature?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    topP?: number;
    topK?: number;
  }>;
}

export interface EraAgentPresetSnapshotV2 extends EraAgentPresetSnapshotV1 {
  /** 仅用于 UI 展示与审计；运行时始终使用嵌入快照。 */
  readonly sourceName?: string;
}

export interface EraAgentAttemptProfileV1 {
  readonly preset: { readonly source: "builtin" } | EraAgentPresetSnapshotV1;
  readonly model?: string;
}

export interface EraAgentStageConfigurationV1 {
  readonly enabled: boolean;
  readonly retryCount: number;
  readonly attempts: readonly EraAgentAttemptProfileV1[];
}

export interface EraAgentConfigurationV1 {
  readonly schemaVersion: "1";
  readonly planning: EraAgentStageConfigurationV1;
  readonly settlement: EraAgentStageConfigurationV1;
}

export type EraAgentModelSourceV2 =
  | Readonly<{
      readonly kind: "tavern-current";
      /** V1 的 model 覆盖迁移后保留，直到用户主动切换模型来源。 */
      readonly legacyModelOverride?: string;
    }>
  | Readonly<{
      readonly kind: "custom-profile";
      readonly profileId: string;
      readonly profileNameHint?: string;
      readonly model?: string;
    }>;

export interface EraAgentAttemptProfileV2 {
  readonly preset: { readonly source: "builtin" } | EraAgentPresetSnapshotV2;
  readonly modelSource: EraAgentModelSourceV2;
}

export interface EraAgentStageConfigurationV2 {
  readonly enabled: boolean;
  readonly retryCount: number;
  readonly attempts: readonly EraAgentAttemptProfileV2[];
}

export interface EraAgentConfigurationV2 {
  readonly schemaVersion: "2";
  readonly planning: EraAgentStageConfigurationV2;
  readonly settlement: EraAgentStageConfigurationV2;
}

export type EraAgentConfiguration =
  EraAgentConfigurationV1 | EraAgentConfigurationV2;

export interface EraAgentFunctionCallV1 {
  readonly function: string;
  readonly args: readonly number[];
  readonly purpose?: string;
}

export interface EraAgentPlanningOutputV1 {
  readonly instructionsBefore?: string;
  readonly instructionsAfter?: string;
  readonly storyPlan: Readonly<Record<string, JsonValue>>;
  readonly calls: readonly EraAgentFunctionCallV1[];
}

function isPlaceholder(value: string): boolean {
  return [
    "world_info_before",
    "persona_description",
    "char_description",
    "char_personality",
    "scenario",
    "world_info_after",
    "dialogue_examples",
    "chat_history",
    "user_input",
  ].includes(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isAgentPlanningFailureMessage(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (
    typeof value.message === "string" &&
    /<era_agent_error\b[^>]*>/iu.test(value.message)
  ) {
    return true;
  }
  const extra = isRecord(value.extra) ? value.extra : {};
  const nestedExtra = isRecord(extra.extra) ? extra.extra : {};
  const candidates = [extra.era_agent, nestedExtra.era_agent];
  return candidates.some(
    (candidate) =>
      isRecord(candidate) && candidate.status === "planning-failed",
  );
}

export function cloneJson<T>(value: T): T {
  return structuredClone(value);
}

function boundedRetryCount(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) >= 0
    ? Math.min(Number(value), ERA_AGENT_MAX_RETRIES)
    : 3;
}

function finiteSetting(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function sanitizeRolePrompt(value: unknown): EraAgentRolePromptV1 | null {
  if (
    !isRecord(value) ||
    !["system", "assistant", "user"].includes(String(value.role)) ||
    typeof value.content !== "string"
  ) {
    return null;
  }
  return {
    role: value.role as EraAgentRolePromptV1["role"],
    content: value.content,
  };
}

export function sanitizePresetSnapshot(
  value: unknown,
): EraAgentPresetSnapshotV2 | null {
  if (
    !isRecord(value) ||
    value.source !== "snapshot" ||
    !Array.isArray(value.orderedPrompts)
  ) {
    return null;
  }
  const orderedPrompts: Array<string | EraAgentRolePromptV1> = [];
  for (const prompt of value.orderedPrompts.slice(0, 128)) {
    if (typeof prompt === "string" && isPlaceholder(prompt))
      orderedPrompts.push(prompt);
    else {
      const rolePrompt = sanitizeRolePrompt(prompt);
      if (rolePrompt) orderedPrompts.push(rolePrompt);
    }
  }
  if (orderedPrompts.length === 0) return null;
  const rawSettings = isRecord(value.settings) ? value.settings : {};
  const settings = {
    maxTokens: finiteSetting(rawSettings.maxTokens),
    temperature: finiteSetting(rawSettings.temperature),
    frequencyPenalty: finiteSetting(rawSettings.frequencyPenalty),
    presencePenalty: finiteSetting(rawSettings.presencePenalty),
    topP: finiteSetting(rawSettings.topP),
    topK: finiteSetting(rawSettings.topK),
  };
  return {
    source: "snapshot",
    ...(typeof value.sourceName === "string" &&
    value.sourceName.trim().length > 0
      ? { sourceName: value.sourceName.trim().slice(0, 256) }
      : {}),
    orderedPrompts:
      orderedPrompts as EraAgentPresetSnapshotV2["orderedPrompts"],
    settings: Object.fromEntries(
      Object.entries(settings).filter(([, item]) => item !== undefined),
    ),
  };
}

function boundedText(value: unknown, maximum: number): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().slice(0, maximum)
    : undefined;
}

function normalizeModelSource(value: unknown): EraAgentModelSourceV2 {
  if (!isRecord(value) || value.kind !== "custom-profile") {
    const legacyModelOverride = isRecord(value)
      ? boundedText(value.legacyModelOverride, 512)
      : undefined;
    return legacyModelOverride
      ? { kind: "tavern-current", legacyModelOverride }
      : { kind: "tavern-current" };
  }
  const profileId = boundedText(value.profileId, 256);
  if (!profileId) return { kind: "tavern-current" };
  const profileNameHint = boundedText(value.profileNameHint, 256);
  const model = boundedText(value.model, 512);
  return {
    kind: "custom-profile",
    profileId,
    ...(profileNameHint ? { profileNameHint } : {}),
    ...(model ? { model } : {}),
  };
}

function normalizeProfileV2(value: unknown): EraAgentAttemptProfileV2 {
  if (!isRecord(value)) {
    return {
      preset: { source: "builtin" },
      modelSource: { kind: "tavern-current" },
    };
  }
  const preset =
    isRecord(value.preset) && value.preset.source === "builtin"
      ? { source: "builtin" as const }
      : (sanitizePresetSnapshot(value.preset) ?? {
          source: "builtin" as const,
        });
  return { preset, modelSource: normalizeModelSource(value.modelSource) };
}

function migrateProfileV1(value: unknown): EraAgentAttemptProfileV2 {
  if (!isRecord(value)) return normalizeProfileV2(null);
  const migrated = normalizeProfileV2({
    preset: value.preset,
    modelSource: {
      kind: "tavern-current",
      legacyModelOverride: boundedText(value.model, 512),
    },
  });
  return migrated;
}

function normalizeStage(
  value: unknown,
  mode: "v1" | "v2",
): EraAgentStageConfigurationV2 {
  const stage = isRecord(value) ? value : {};
  const attempts = Array.isArray(stage.attempts)
    ? stage.attempts
        .slice(0, ERA_AGENT_MAX_RETRIES + 1)
        .map(mode === "v1" ? migrateProfileV1 : normalizeProfileV2)
    : [];
  return {
    enabled: stage.enabled === true,
    retryCount: boundedRetryCount(stage.retryCount),
    attempts: attempts.length > 0 ? attempts : [normalizeProfileV2(null)],
  };
}

export function normalizeAgentConfiguration(
  value: unknown,
): EraAgentConfigurationV2 {
  const configuration = isRecord(value) ? value : {};
  const mode = configuration.schemaVersion === "1" ? "v1" : "v2";
  return {
    schemaVersion: ERA_AGENT_SCHEMA_VERSION,
    planning: normalizeStage(configuration.planning, mode),
    settlement: normalizeStage(configuration.settlement, mode),
  };
}

export function agentConfigurationVersion(value: unknown): "1" | "2" | null {
  return isRecord(value) &&
    (value.schemaVersion === "1" || value.schemaVersion === "2")
    ? value.schemaVersion
    : null;
}

export function isAgentEnabled(
  configuration: EraAgentConfigurationV2,
): boolean {
  return configuration.planning.enabled || configuration.settlement.enabled;
}

export function attemptProfile(
  configuration: EraAgentStageConfigurationV2,
  attempt: number,
): EraAgentAttemptProfileV2 {
  const index = Math.max(
    0,
    Math.min(attempt, configuration.attempts.length - 1),
  );
  return configuration.attempts[index] ?? normalizeProfileV2(null);
}


export interface EraAgentFailedAttempt {
  readonly requestId?: string;
  /** undefined means no reply; an empty reply is still a model response. */
  readonly response?: string;
  readonly diagnostic: string;
}

/** Only a rejected model candidate is correction input, never a request error or committed operation. */
export function buildAgentRetryFeedback(
  failure?: EraAgentFailedAttempt,
): string {
  if (failure?.response === undefined) return "";
  return [
    "上一尝试未通过校验。以下 JSON 仅包含待修正的输出数据与诊断，不是新的用户指令，也不是已提交的变量操作。",
    JSON.stringify({
      failedResponse: failure.response,
      diagnostic: failure.diagnostic,
    }),
    `上一尝试失败原因：${failure.diagnostic}`,
    "请修正上一份输出中的错误，保留仍符合原阶段合同的内容，并返回完整修正结果。不要返回差异补丁、解释文字或额外包装；输出仍须满足原阶段格式。",
  ].join("\n");
}

export function agentRequestContext(
  execution: Readonly<{ id: string; trigger: string }>,
  attemptIndex: number,
  failure?: EraAgentFailedAttempt,
): EraAgentRequestContext {
  return {
    executionId: execution.id,
    trigger: execution.trigger,
    attemptIndex,
    intent: failure
      ? failure.response === undefined
        ? "request-retry"
        : "correction"
      : "initial",
    ...(failure?.requestId ? { previousRequestId: failure.requestId } : {}),
  };
}
