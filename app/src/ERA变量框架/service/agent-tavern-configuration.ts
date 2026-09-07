/*
 * 模块职责：封装 Agent 角色卡配置、预设脱敏快照和本机连接方案存储。
 * 模块边界：本模块只处理 Tavern 持久化事实，不执行模型请求或 Agent 会话决策。
 */

import { currentTavernContext } from './tavern-browser-host';

const AGENT_LOCAL_SETTINGS_KEY = 'era_agent';
export const MAX_CONNECTION_PROFILES = 64;

/** 本机私密连接方案；key 只能停留在宿主设置层，任何跨层结果必须使用脱敏摘要。 */
export type LocalConnectionProfile = {
  readonly id: string;
  name: string;
  apiUrl: string;
  key: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function clonePortable<T>(value: T): T {
  return structuredClone(value);
}

/** 必须在群聊返回 null，否则角色卡配置可能被误写到不确定的群成员。 */
export function currentCharacterIndex(): number | null {
  const context = currentTavernContext();
  if (typeof context.groupId === 'string' && context.groupId.length > 0) return null;
  const index = Number(context.characterId);
  return Number.isSafeInteger(index) && index >= 0 && index < context.characters.length ? index : null;
}

/** 从当前角色卡未知扩展字段读取便携配置，必须克隆以隔离 Tavern 可变对象。 */
export function currentAgentConfiguration(): unknown {
  const context = currentTavernContext();
  const index = currentCharacterIndex();
  if (index === null) return null;
  const character = context.characters[index];
  const data = isRecord(character?.data) ? character.data : null;
  const extensions = data !== null && isRecord(data.extensions) ? (data.extensions as Record<string, unknown>) : null;
  return extensions !== null && isRecord(extensions.era_agent) ? clonePortable(extensions.era_agent) : null;
}

function localConnectionStore(): Record<string, unknown> {
  const tavern = currentTavernContext();
  const root = isRecord(tavern.extensionSettings[AGENT_LOCAL_SETTINGS_KEY])
    ? tavern.extensionSettings[AGENT_LOCAL_SETTINGS_KEY]
    : {};
  if (!isRecord(root.connectionProfiles)) root.connectionProfiles = {};
  tavern.extensionSettings[AGENT_LOCAL_SETTINGS_KEY] = root;
  return root;
}

export function connectionProfiles(): Record<string, unknown> {
  const root = localConnectionStore();
  return isRecord(root.connectionProfiles) ? root.connectionProfiles : {};
}

export function profileId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(id) ? id : null;
}

/** 收窄本机设置中的未知记录；字段不完整时忽略，避免将损坏密钥方案暴露给 Service。 */
export function profileRecord(value: unknown): LocalConnectionProfile | null {
  if (!isRecord(value)) return null;
  const id = profileId(value.id);
  if (
    id === null ||
    typeof value.name !== 'string' ||
    typeof value.apiUrl !== 'string' ||
    typeof value.key !== 'string'
  ) {
    return null;
  }
  return { id, name: value.name, apiUrl: value.apiUrl, key: value.key };
}

export function requireProfile(idValue: unknown): LocalConnectionProfile {
  const id = profileId(idValue);
  const profile = id === null ? null : profileRecord(connectionProfiles()[id]);
  if (profile === null) {
    throw new TypeError('ERA_AGENT_PROFILE_MISSING：本机连接方案不存在，需要重新绑定。');
  }
  return profile;
}

export function profileSummary(profile: LocalConnectionProfile): Record<string, unknown> {
  return {
    id: profile.id,
    name: profile.name,
    apiUrl: profile.apiUrl,
    hasKey: profile.key.length > 0,
  };
}

export function readConnectionSummaries(): Record<string, unknown>[] {
  return Object.values(connectionProfiles())
    .map(profileRecord)
    .filter((profile): profile is LocalConnectionProfile => profile !== null)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    .map(profileSummary);
}

/** 仅接受有界 HTTP(S) 地址，否则 generateRaw 可能被传入非网络协议或空目标。 */
export function requireApiUrl(value: unknown): string {
  if (typeof value !== 'string') throw new TypeError('连接方案缺少 API 地址。');
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) throw new TypeError('API 地址长度无效。');
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch (error) {
    throw new TypeError('API 地址不是有效 URL。', { cause: error });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError('API 地址仅支持 HTTP 或 HTTPS。');
  }
  return trimmed.replace(/\/+$/u, '');
}

export function newProfileId(): string {
  return `profile-${crypto.randomUUID()}`;
}

type CapturedPrompt = NonNullable<GenerateRawConfig['ordered_prompts']>[number];

/** 将单条宿主预设提示收窄到 ERA 允许携带的占位符或角色文本。 */
function capturePrompt(
  prompt: Record<string, unknown>,
  placeholders: Readonly<Record<string, PlaceholderPrompt>>,
): CapturedPrompt | null {
  if (prompt.enabled === false) return null;
  const id = typeof prompt.id === 'string' ? prompt.id : '';
  const placeholder = placeholders[id];
  if (placeholder) return placeholder;
  if (typeof prompt.content !== 'string') return null;
  return {
    role: prompt.role === 'assistant' || prompt.role === 'user' ? prompt.role : 'system',
    content: prompt.content,
  };
}

/** 阶段输入必须在末尾 assistant 预填充之前，否则模型接收顺序与预设意图相反。 */
function includeStageInput(prompts: CapturedPrompt[]): void {
  if (prompts.includes('user_input')) return;
  let index = prompts.length;
  while (index > 0) {
    const prompt = prompts[index - 1];
    if (typeof prompt === 'string' || prompt?.role !== 'assistant') break;
    index -= 1;
  }
  prompts.splice(index, 0, 'user_input');
}

/**
 * 从指定 Tavern 预设生成有界脱敏快照，只保留提示顺序和通用采样参数。
 * 必须主动白名单复制；否则 API、代理、脚本、正则与第三方扩展可能随角色卡泄漏。
 */
export function capturePreset(input: Readonly<Record<string, unknown>>): unknown {
  const context = currentTavernContext();
  if (typeof context.groupId === 'string' && context.groupId.length > 0) {
    throw new TypeError('群聊不支持 ERA 多阶段生成预设。');
  }
  const name = typeof input.name === 'string' && input.name.trim().length > 0 ? input.name.trim() : 'in_use';
  const preset = getPreset(name);
  const placeholders: Readonly<Record<string, PlaceholderPrompt>> = {
    worldInfoBefore: 'world_info_before',
    personaDescription: 'persona_description',
    charDescription: 'char_description',
    charPersonality: 'char_personality',
    scenario: 'scenario',
    worldInfoAfter: 'world_info_after',
    dialogueExamples: 'dialogue_examples',
    chatHistory: 'chat_history',
  };
  const prompts: GenerateRawConfig['ordered_prompts'] = [];
  for (const rawPrompt of Array.isArray(preset.prompts) ? preset.prompts.slice(0, 256) : []) {
    if (!isRecord(rawPrompt)) continue;
    const prompt = capturePrompt(rawPrompt, placeholders);
    if (prompt !== null) prompts.push(prompt);
  }
  includeStageInput(prompts);
  const settings: Record<string, unknown> = isRecord(preset.settings) ? preset.settings : {};
  return clonePortable({
    source: 'snapshot',
    sourceName: name === 'in_use' ? `当前正在使用（${getLoadedPresetName()}）` : name,
    orderedPrompts: prompts,
    settings: Object.fromEntries(
      Object.entries({
        maxTokens: settings.max_completion_tokens,
        temperature: settings.temperature,
        frequencyPenalty: settings.frequency_penalty,
        presencePenalty: settings.presence_penalty,
        topP: settings.top_p,
        topK: settings.top_k,
      }).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)),
    ),
  });
}
/** 只记录请求发起时可公开的宿主选择，绝不复制完整连接设置或密钥。 */
export function storyHostConfiguration(): Record<string, unknown> {
  return {
    model: SillyTavern.getChatCompletionModel(),
    preset: getLoadedPresetName(),
    provider: SillyTavern.chatCompletionSettings?.chat_completion_source ?? '未采集',
  };
}
