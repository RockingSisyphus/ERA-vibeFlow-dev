/** Capability adapter and immutable context projections for the Service Agent session. */
import { prepareSessionWrite, type SessionBindingFacts } from "./agent_session_binding.ts";
import { attemptProfile, type EraAgentConfigurationV2 } from "./agent_configuration.ts";
import { builtinStagePrompts, countAgentCycles, extractEraMessageKey, formatAgentPlanReport } from "./agent_report_text.ts";
import type { EraAgentRequestContext } from "./agent_configuration.ts";
import type { AgentOutcome, GenerationRequest } from "./agent_flow_types.ts";
import type { EraAgentFloorCandidateV1, EraFloorIdentityV1 } from "@era/vibeflow-contracts";

export function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface AgentCapability {
  await_native_completion(
    input: Readonly<Record<string, unknown>>,
  ): Promise<unknown>;
  generate(input: Readonly<Record<string, unknown>>): Promise<unknown>;
  generate_story(input: Readonly<Record<string, unknown>>): Promise<unknown>;
  inject_once(input: Readonly<Record<string, unknown>>): unknown;
  read_session_binding(input: Readonly<Record<string, unknown>>): unknown;
  write_session(input: Readonly<Record<string, unknown>>): unknown;
  clear_session(input: Readonly<Record<string, unknown>>): unknown;
  create_error_message(
    input: Readonly<Record<string, unknown>>,
  ): Promise<unknown>;
  stop_native_generation(input: Readonly<Record<string, unknown>>): unknown;
}

export function writeSession(
  capability: Pick<AgentCapability, "read_session_binding" | "write_session">,
  input: Readonly<Record<string, unknown>>,
): unknown {
  const facts = capability.read_session_binding({
    chatKey: input.chatKey,
  }) as SessionBindingFacts;
  return capability.write_session(prepareSessionWrite(input, facts));
}

export class AgentSessionFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AgentSessionFailure";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function throwHostGenerationFailure(result: unknown): void {
  if (!isRecord(result) || result.status !== "failed") return;
  const diagnostic = isRecord(result.diagnostic) ? result.diagnostic : {};
  const code =
    typeof diagnostic.code === "string" && diagnostic.code.length > 0
      ? diagnostic.code
      : "ERA_AGENT_AUXILIARY_REQUEST_FAILED";
  const message =
    typeof diagnostic.message === "string" && diagnostic.message.length > 0
      ? diagnostic.message
      : `${code}：辅助模型请求失败。`;
  throw new AgentSessionFailure(code, message);
}

export function chatKey(context: Record<string, unknown>): string {
  const identity = isRecord(context.identity) ? context.identity : {};
  return typeof identity.chatId === "string" && identity.chatId.length > 0
    ? identity.chatId
    : "unknown-chat";
}

export function stateContext(context: Record<string, unknown>): Readonly<{
  revision: number;
  statData: unknown;
  statFunc: Readonly<Record<string, unknown>>;
}> {
  const state = isRecord(context.state) ? context.state : {};
  return {
    revision: Number.isSafeInteger(state.revision) ? Number(state.revision) : 0,
    statData: Object.prototype.hasOwnProperty.call(state, "statData")
      ? structuredClone(state.statData)
      : {},
    statFunc: isRecord(state.statFunc) ? structuredClone(state.statFunc) : {},
  };
}

export function latestMessage(
  context: Record<string, unknown>,
): Record<string, unknown> | null {
  return isRecord(context.latestMessage) ? context.latestMessage : null;
}

export function lastUserText(context: Record<string, unknown>): string {
  const messages = Array.isArray(context.messages) ? context.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      isRecord(message) &&
      message.role === "user" &&
      typeof message.message === "string"
    )
      return message.message;
  }
  return "";
}

export function sessionObject(
  context: Record<string, unknown>,
): Record<string, unknown> | null {
  return isRecord(context.session) ? structuredClone(context.session) : null;
}

export function isAwaitingStorySession(
  context: Record<string, unknown>,
  session: Record<string, unknown> | null,
): session is Record<string, unknown> {
  return (
    session !== null &&
    session.chatKey === chatKey(context) &&
    (session.status === "opened" || session.status === "planned")
  );
}

/** 重进仅从最后一个持久化规划及实际正文恢复必要成果，不恢复历史请求。 */
export function restoreMessageSession(
  context: Record<string, unknown>,
  configuration: EraAgentConfigurationV2,
): Record<string, unknown> | null {
  const latest = latestMessage(context);
  if (
    !latest ||
    latest.role !== "assistant" ||
    typeof latest.message !== "string"
  )
    return null;
  const extra =
    isRecord(latest.extra) && isRecord(latest.extra.era_agent)
      ? latest.extra.era_agent
      : null;
  if (!extra) return null;
  const text = latest.message;
  const block = [...text.matchAll(/<era_plan>([\s\S]*?)<\/era_plan>/giu)].at(
    -1,
  );
  let finalPlan: Record<string, unknown> = {};
  if (block) {
    const parsed: unknown = JSON.parse(block[1]);
    if (isRecord(parsed)) finalPlan = parsed;
  }
  const baseMessage = block ? text.slice(0, block.index) : "";
  const storyStart =
    typeof extra.storyStart === "number"
      ? extra.storyStart
      : block
        ? block.index! + block[0].length
        : 0;
  const storyEnd =
    typeof extra.storyEnd === "number" ? extra.storyEnd : text.length;
  const story = text.slice(storyStart, storyEnd);
  return {
    schemaVersion: 1,
    chatKey: chatKey(context),
    messageId: latest.message_id,
    configuration,
    status: extra.status ?? "story-complete",
    cycleIndex: extra.cycleIndex ?? 0,
    baseMessage,
    story,
    plan: finalPlan.plan ?? null,
    functionResults: finalPlan.functionResults ?? [],
    planReport: block
      ? formatAgentPlanReport({
          plan: finalPlan.plan,
          functionResults: finalPlan.functionResults,
        })
      : "",
    sourceKey: extractEraMessageKey(text) ?? "",
  };
}

export function boundedTrace(value: string): string {
  return value.slice(0, 131072);
}

export function openedSession(
  context: Record<string, unknown>,
  configuration: EraAgentConfigurationV2,
  kind: string,
  eventId: string,
): Record<string, unknown> {
  const latest = latestMessage(context);
  const continuing =
    kind === "continue" &&
    latest?.role === "assistant" &&
    typeof latest.message === "string";
  const baseMessage = continuing ? (latest.message as string) : "";
  return {
    schemaVersion: 2,
    chatKey: chatKey(context),
    status: "opened",
    execution: { id: eventId, trigger: kind === "normal" ? "initial" : kind },
    cycleIndex: continuing ? countAgentCycles(baseMessage) : 0,
    baseMessage,
    configuration,
    preState: stateContext(context),
  };
}

export function stageRequest(
  profile: ReturnType<typeof attemptProfile>,
  stage: "planning" | "settlement",
  userInput: string,
  generationId: string,
  requestContext: EraAgentRequestContext,
): Record<string, unknown> {
  const preset = profile.preset;
  const orderedPrompts =
    preset.source === "builtin"
      ? builtinStagePrompts(stage)
      : preset.orderedPrompts;
  const settings = preset.source === "builtin" ? {} : (preset.settings ?? {});
  return {
    generationId,
    requestContext,
    stage,
    userInput,
    orderedPrompts,
    resolvePresetMacros: preset.source === "snapshot",
    requestPolicy: buildAgentRequestPolicy(profile.modelSource, settings),
  };
}

export function sessionExecution(
  session: Record<string, unknown> | null,
  eventId: string,
) {
  const execution = session?.execution;
  return isRecord(execution) &&
    typeof execution.id === "string" &&
    typeof execution.trigger === "string"
    ? { id: execution.id, trigger: execution.trigger }
    : { id: eventId, trigger: "unrecorded" };
}


export function outcome(
  mode: AgentOutcome["mode"],
  status: AgentOutcome["status"] = "no-op",
  diagnostics: AgentOutcome["diagnostics"] = [],
  value?: unknown,
  candidate?: EraAgentFloorCandidateV1,
): AgentOutcome {
  return {
    mode,
    status,
    diagnostics,
    ...(value === undefined ? {} : { value }),
    ...(candidate ? { candidate } : {}),
  };
}
export function requestIdentity(request: GenerationRequest): EraFloorIdentityV1 {
  if (request.identityError)
    throw new AgentSessionFailure(
      request.identityError.code,
      request.identityError.message,
    );
  if (!request.identity)
    throw new AgentSessionFailure(
      "ERA_AGENT_FLOOR_IDENTITY_REQUIRED",
      "Agent 楼层候选缺少真实 assistant 楼层身份。",
    );
  return request.identity;
}

// agent request policy rules.
/** Agent 预设与辅助请求的纯规则；由生成会话在实际请求位置调用。 */
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function settingFields() { return {
  maxTokens: "max_completion_tokens", temperature: "temperature", frequencyPenalty: "frequency_penalty",
  presencePenalty: "presence_penalty", topP: "top_p", topK: "top_k",
} as const; }
type Prompt = string | { role: string; content: string };
export function agentPresetName(value: unknown): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "in_use";
}
export function captureAgentPresetSnapshot(value: unknown): Record<string, unknown> {
  const PLACEHOLDERS: Readonly<Record<string, string>> = {
    worldInfoBefore: "world_info_before", personaDescription: "persona_description",
    charDescription: "char_description", charPersonality: "char_personality", scenario: "scenario",
    worldInfoAfter: "world_info_after", dialogueExamples: "dialogue_examples", chatHistory: "chat_history",
  };
  const facts = record(value);
  const prompts: Prompt[] = [];
  for (const value of Array.isArray(facts.prompts) ? facts.prompts : []) {
    const prompt = record(value);
    if (prompt.enabled === false) continue;
    const placeholder = PLACEHOLDERS[typeof prompt.id === "string" ? prompt.id : ""];
    if (placeholder) prompts.push(placeholder);
    else if (typeof prompt.content === "string") prompts.push({ role: prompt.role === "assistant" || prompt.role === "user" ? prompt.role : "system", content: prompt.content });
  }
  if (!prompts.includes("user_input")) {
    let index = prompts.length;
    while (index > 0) {
      const prompt = prompts[index - 1];
      if (typeof prompt === "string" || prompt.role !== "assistant") break;
      index -= 1;
    }
    prompts.splice(index, 0, "user_input");
  }
  const settings = record(facts.settings);
  return {
    source: "snapshot", sourceName: facts.requestedName === "in_use" ? `当前正在使用（${facts.loadedName}）` : facts.requestedName,
    orderedPrompts: prompts,
    settings: Object.fromEntries(Object.entries(settingFields()).map(([key, source]) => [key, settings[source]]).filter(([, value]) => typeof value === "number" && Number.isFinite(value))),
  };
}
export interface AgentRequestPolicy {
  readonly binding: { readonly kind: "custom-profile" | "tavern-current"; readonly profileId: unknown; readonly model: string | null };
  readonly sampling: Readonly<Record<string, number | "same_as_preset">>;
}
export function buildAgentRequestPolicy(modelSourceValue: unknown, settingsValue: unknown): AgentRequestPolicy {
  const source = record(modelSourceValue);
  const custom = source.kind === "custom-profile";
  const model = custom && typeof source.model === "string" && source.model.length > 0 ? source.model
    : source.kind === "tavern-current" && typeof source.legacyModelOverride === "string" ? source.legacyModelOverride : null;
  const settings = record(settingsValue);
  return {
    binding: { kind: custom ? "custom-profile" : "tavern-current", profileId: custom ? source.profileId ?? null : null, model },
    sampling: Object.fromEntries(Object.keys(settingFields()).map(key => [key, typeof settings[key] === "number" && Number.isFinite(settings[key]) ? settings[key] : "same_as_preset"])),
  };
}
