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
