import type { JsonValue } from "@era/vibeflow-contracts";
import { executeExpressionLayer } from "@era/vibeflow-expression/engine";
import { applyMessageCommands } from "./domain/crud_engine.ts";

export const ERA_AGENT_SCHEMA_VERSION = "2" as const;
export const ERA_AGENT_MAX_RETRIES = 16;
export const ERA_AGENT_MAX_CALLS = 32;
export const ERA_AGENT_MAX_TRACE_CHARS = 131072;

export type EraAgentStage = "planning" | "settlement";
export type EraAgentRetryKind = "planning" | "story" | "settlement";

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

export type EraAgentConfiguration = EraAgentConfigurationV1 | EraAgentConfigurationV2;

export interface EraAgentFunctionCallV1 {
  readonly function: string;
  readonly args: readonly number[];
  readonly purpose?: string;
}

export interface EraAgentPlanningOutputV1 {
  readonly storyPlan: Readonly<Record<string, JsonValue>>;
  readonly calls: readonly EraAgentFunctionCallV1[];
}

export interface EraAgentOperationV1 {
  readonly insert?: Readonly<Record<string, JsonValue>>;
  readonly edit?: Readonly<Record<string, JsonValue>>;
  readonly delete?: Readonly<Record<string, JsonValue>>;
  readonly functionInsert?: Readonly<Record<string, JsonValue>>;
  readonly functionEdit?: Readonly<Record<string, JsonValue>>;
  readonly functionDelete?: Readonly<Record<string, JsonValue>>;
}

export interface EraAgentSettlementOutputV1 {
  readonly operations: readonly EraAgentOperationV1[];
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

function isOperationKey(value: string): boolean {
  return [
    "insert",
    "edit",
    "delete",
    "functionInsert",
    "functionEdit",
    "functionDelete",
  ].includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
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

function cloneJson<T>(value: T): T {
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
    ...(typeof value.sourceName === "string" && value.sourceName.trim().length > 0
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
    return { preset: { source: "builtin" }, modelSource: { kind: "tavern-current" } };
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
    attempts:
      attempts.length > 0 ? attempts : [normalizeProfileV2(null)],
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
  return isRecord(value) && (value.schemaVersion === "1" || value.schemaVersion === "2")
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

function parseJsonObject(raw: string, label: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed;
  if (unfenced.length > ERA_AGENT_MAX_TRACE_CHARS)
    throw new RangeError(`${label}超过长度上限。`);
  let value: unknown;
  try {
    value = JSON.parse(unfenced);
  } catch (error) {
    throw new SyntaxError(
      `${label}不是严格 JSON：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!isRecord(value)) throw new TypeError(`${label}必须是 JSON 对象。`);
  return value;
}

export function parsePlanningOutput(raw: string): EraAgentPlanningOutputV1 {
  const value = parseJsonObject(raw, "规划响应");
  if (!isRecord(value.storyPlan) || !Array.isArray(value.calls)) {
    throw new TypeError("规划响应必须包含 storyPlan 对象与 calls 数组。");
  }
  if (value.calls.length > ERA_AGENT_MAX_CALLS) {
    throw new RangeError(`规划函数调用不得超过 ${ERA_AGENT_MAX_CALLS} 项。`);
  }
  const calls = value.calls.map((candidate, index): EraAgentFunctionCallV1 => {
    if (
      !isRecord(candidate) ||
      typeof candidate.function !== "string" ||
      !Array.isArray(candidate.args)
    ) {
      throw new TypeError(`calls[${index}] 缺少 function 或 args。`);
    }
    const name = candidate.function.trim();
    if (!/^[A-Za-z_$][\w$]*$/u.test(name))
      throw new TypeError(`calls[${index}] 的函数名无效。`);
    if (
      !candidate.args.every(
        (item) => typeof item === "number" && Number.isFinite(item),
      )
    ) {
      throw new TypeError(`calls[${index}] 只允许有限数值参数。`);
    }
    const purpose =
      typeof candidate.purpose === "string"
        ? candidate.purpose.slice(0, 2048)
        : undefined;
    return purpose
      ? { function: name, args: candidate.args as number[], purpose }
      : { function: name, args: candidate.args as number[] };
  });
  return {
    storyPlan: cloneJson(value.storyPlan) as Record<string, JsonValue>,
    calls,
  };
}

export function parseSettlementOutput(raw: string): EraAgentSettlementOutputV1 {
  const value = parseJsonObject(raw, "变量分析响应");
  if (!Array.isArray(value.operations))
    throw new TypeError("变量分析响应必须包含 operations 数组。");
  if (value.operations.length > 128)
    throw new RangeError("变量操作不得超过 128 项。");
  const operations = value.operations.map(
    (candidate, index): EraAgentOperationV1 => {
      if (!isRecord(candidate))
        throw new TypeError(`operations[${index}] 必须是对象。`);
      const keys = Object.keys(candidate);
      if (keys.length !== 1 || !isOperationKey(keys[0] ?? "")) {
        throw new TypeError(
          `operations[${index}] 必须且只能包含一种 ERA 操作。`,
        );
      }
      const payload = candidate[keys[0] as keyof typeof candidate];
      if (!isRecord(payload))
        throw new TypeError(`operations[${index}] 的操作内容必须是对象。`);
      return cloneJson(candidate) as EraAgentOperationV1;
    },
  );
  return { operations };
}

function safeReport(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e");
}

export function formatAgentPlanReport(value: unknown): string {
  return `<era_plan>${safeReport(value)}</era_plan>`;
}

export function formatAgentUpdateReport(value: unknown): string {
  return `<era_update>${safeReport(value)}</era_update>`;
}

export function formatAgentTransaction(
  operations: readonly EraAgentOperationV1[],
): string {
  const body = operations
    .map((operation) => {
      const [kind, payload] = Object.entries(operation)[0] ?? [];
      const tags: Record<string, string> = {
        insert: "VariableInsert",
        edit: "VariableEdit",
        delete: "VariableDelete",
        functionInsert: "FunctionInsert",
        functionEdit: "FunctionEdit",
        functionDelete: "FunctionDelete",
      };
      const tag = tags[kind ?? ""];
      if (!tag) throw new TypeError(`不支持的 ERA 操作：${String(kind)}。`);
      return `<${tag}>${safeReport(payload)}</${tag}>`;
    })
    .join("");
  return `<era_tx s="m">${body}</era_tx>`;
}

export function stripAgentReportsForPrompt(text: string): string {
  return text
    .replace(/<era_plan>[\s\S]*?<\/era_plan>/giu, "")
    .replace(/<era_update>[\s\S]*?<\/era_update>/giu, "")
    .replace(/<era_agent_error>[\s\S]*?<\/era_agent_error>/giu, "")
    .trim();
}

export function extractEraMessageKey(text: string): string | null {
  const match = text.match(/["']?era-message-key["']?\s*=\s*["']([^"']+)["']/u);
  return match?.[1] ?? null;
}

export function countAgentCycles(text: string): number {
  const plans = text.match(/<era_plan>/giu)?.length ?? 0;
  const updates = text.match(/<era_update>/giu)?.length ?? 0;
  return Math.max(plans, updates);
}

export function isolateStoryEraCommands(
  text: string,
): Readonly<{ story: string; audit: string }> {
  const patterns = [
    /<era_tx\b[^>]*>[\s\S]*?<\/era_tx>/giu,
    /<(?:Variable|Function)(?:Insert|Edit|Delete)\b[^>]*>[\s\S]*?<\/(?:Variable|Function)(?:Insert|Edit|Delete)>/giu,
  ];
  const captured: string[] = [];
  let story = text;
  for (const pattern of patterns) {
    story = story.replace(pattern, (match) => {
      captured.push(match);
      return "";
    });
  }
  story = stripAgentReportsForPrompt(story)
    .replace(/<era_data\b[^>]*>[\s\S]*?<\/era_data>/giu, "")
    .replace(/<StatusPlaceHolderImpl\s*\/>/giu, "")
    .trim();
  return { story, audit: captured.join("\n") };
}

export function builtinStagePrompts(
  stage: EraAgentStage,
): readonly (string | EraAgentRolePromptV1)[] {
  const contract =
    stage === "planning"
      ? '只输出严格 JSON：{"storyPlan":对象,"calls":[{"function":字符串,"args":数值数组,"purpose":可选字符串}]}。规划故事并仅列出确有必要的纯数值函数调用，不写正文。'
      : '只输出严格 JSON：{"operations":[ERA 有序操作]}。根据正式故事与给定状态生成必要的变量或函数操作；没有变化时返回空数组。';
  return [
    {
      role: "system",
      content: `你是 ERA ${stage === "planning" ? "故事规划" : "变量结算"}阶段。${contract}`,
    },
    "char_description",
    "char_personality",
    "scenario",
    "world_info_before",
    "world_info_after",
    "chat_history",
    "user_input",
  ];
}

export function buildStoryInjection(
  input: Readonly<{
    plan: EraAgentPlanningOutputV1;
    results: readonly Readonly<Record<string, JsonValue>>[];
  }>,
): string {
  return [
    "以下是 ERA 在正文生成前完成的故事计划与纯函数结果。请使用当前酒馆预设正常创作正式故事，不要复述报告，也不要自行改写函数结果。",
    safeReport({
      storyPlan: input.plan.storyPlan,
      calls: input.plan.calls,
      results: input.results,
    }),
  ].join("\n");
}

export interface EraAgentExecutedCallV1 {
  readonly index: number;
  readonly function: string;
  readonly args: readonly number[];
  readonly result: number;
  readonly drawOffsetStart: number;
  readonly drawOffsetEnd: number;
}

export function executeAgentFunctionCalls(
  input: Readonly<{
    calls: readonly EraAgentFunctionCallV1[];
    statData: unknown;
    statFunc: Readonly<Record<string, unknown>>;
    sourceKey: string;
    drawOffset?: number;
  }>,
): Readonly<{
  results: readonly EraAgentExecutedCallV1[];
  nextDrawOffset: number;
}> {
  let drawOffset = input.drawOffset ?? 0;
  const results: EraAgentExecutedCallV1[] = [];
  const knownFunctions = new Set([
    ...Object.keys(input.statFunc),
    "abs",
    "ceil",
    "clamp",
    "cos",
    "exp",
    "floor",
    "log",
    "max",
    "min",
    "pow",
    "random",
    "round",
    "sin",
    "sqrt",
    "tan",
  ]);
  for (const call of input.calls) {
    if (!knownFunctions.has(call.function))
      throw new TypeError(`函数调用表包含未知函数：${call.function}。`);
  }
  for (const [index, call] of input.calls.entries()) {
    const expression = `${call.function}(${call.args.map((value) => JSON.stringify(value)).join(",")})`;
    const start = drawOffset;
    const response = executeExpressionLayer({
      initialState: { __eraAgentResult: 0 },
      snapshotState: isRecord(input.statData) ? cloneJson(input.statData) : {},
      functionLibrary: cloneJson(input.statFunc),
      snapshotFunctionLibrary: cloneJson(input.statFunc),
      allowSnapshots: true,
      randomContext: { sourceKey: input.sourceKey, drawOffset },
      operations: [{ path: "__eraAgentResult", expr: expression }],
    });
    if (response.diagnostics.length > 0) {
      const diagnostic = response.diagnostics[0];
      throw new TypeError(
        `${call.function} 调用失败：${diagnostic?.code ?? "ERA_AGENT_FUNCTION_FAILED"} ${diagnostic?.message ?? ""}`.trim(),
      );
    }
    const result = (response.finalState as Record<string, unknown>)
      .__eraAgentResult;
    if (typeof result !== "number" || !Number.isFinite(result)) {
      throw new TypeError(`${call.function} 未返回有限数值。`);
    }
    drawOffset = response.nextDrawOffset;
    results.push({
      index,
      function: call.function,
      args: [...call.args],
      result,
      drawOffsetStart: start,
      drawOffsetEnd: drawOffset,
    });
  }
  return { results, nextDrawOffset: drawOffset };
}

export function validateSettlementOperations(
  input: Readonly<{
    operations: readonly EraAgentOperationV1[];
    statData: unknown;
    statFunc: Readonly<Record<string, unknown>>;
    messageId: number;
    sourceKey: string;
  }>,
): Readonly<{
  transaction: string;
  finalStat: unknown;
  finalStatFunc: Readonly<Record<string, unknown>>;
}> {
  const transaction = formatAgentTransaction(input.operations);
  const trial = applyMessageCommands({
    content: transaction,
    messageId: input.messageId,
    initialStat: input.statData,
    initialStatFunc: input.statFunc,
    meta: {},
    randomSourceKey: input.sourceKey,
  });
  if (
    trial.commands.length !== input.operations.length ||
    trial.diagnostics.length > 0
  ) {
    const diagnostic = trial.diagnostics[0];
    throw new TypeError(
      diagnostic
        ? `${diagnostic.code}: ${diagnostic.message}`
        : "变量操作未被 ERA 命令引擎完整接受。",
    );
  }
  return {
    transaction,
    finalStat: trial.finalStat,
    finalStatFunc: trial.finalStatFunc ?? input.statFunc,
  };
}
