/*
 * 模块职责：把 Agent 辅助阶段的模型来源解析成 generateRaw 请求与脱敏路由证据。
 * 模块边界：不执行网络请求、不读取角色卡，只在 Host 内部短暂展开本机密钥。
 */

import { clonePortable, isRecord, requireProfile, type LocalConnectionProfile } from './agent-tavern-configuration';
import type { AgentRequestContext } from './agent-execution-records';

/** 从工作流明确保存的执行身份创建原生正文记录；旧会话不能猜测触发来源。 */
export function nativeStoryRequestContext(session: Record<string, unknown>): AgentRequestContext | undefined {
  const execution = session.execution;
  return isRecord(execution) && typeof execution.id === 'string' && typeof execution.trigger === 'string'
    ? { executionId: execution.id, trigger: execution.trigger, attemptIndex: 0, intent: 'initial' }
    : undefined;
}

/** 正文重生成必须复用 Helper 原生请求与 Service 的 injection，避免 Host 再执行规划函数或重掷骰子。 */
export function storyRetryConfiguration(requestId: string, userInput: string, injection: string): GenerateConfig {
  return {
    generation_id: requestId,
    user_input: userInput,
    should_stream: true,
    should_silence: false,
    ...(injection.length > 0
      ? {
          injects: [
            { role: 'system' as const, content: injection, position: 'in_chat' as const, depth: 0, should_scan: false },
          ],
        }
      : {}),
  };
}

/** 传输异常必须保留可重试诊断，但不能将未知供应商错误中的密钥带入报告。 */
export function auxiliaryFailureResult(error: unknown): Readonly<Record<string, unknown>> {
  const rawMessage = error instanceof Error ? error.message : '';
  const code = rawMessage.match(/\bERA_AGENT_[A-Z0-9_]+\b/)?.[0] ?? 'ERA_AGENT_AUXILIARY_REQUEST_FAILED';
  const message = rawMessage.includes(code)
    ? rawMessage.slice(0, 512)
    : 'ERA_AGENT_AUXILIARY_REQUEST_FAILED：辅助模型请求失败。';
  return { status: 'failed', diagnostic: { code, message } };
}

/** Helper 将自定义角色提示当作原文；每次请求按预设顺序委托酒馆展开宏，不能改写保存的快照。 */
export function auxiliaryOrderedPrompts(
  input: Readonly<Record<string, unknown>>,
): GenerateRawConfig['ordered_prompts'] {
  const prompts = clonePortable(input.orderedPrompts) as NonNullable<GenerateRawConfig['ordered_prompts']>;
  return input.resolvePresetMacros === true
    ? prompts.map(prompt =>
        typeof prompt === 'string' ? prompt : { ...prompt, content: substitudeMacros(prompt.content) },
      )
    : prompts;
}

export type AuxiliaryRoute = {
  readonly profile: LocalConnectionProfile | null;
  readonly model: string | undefined;
};

/** 仅允许有限数覆盖当前预设，其他值必须显式回退宿主配置。 */
function numericSetting(settings: Record<string, unknown>, key: string): number | 'same_as_preset' {
  const value = settings[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 'same_as_preset';
}

/** 将 V1 模型覆盖与 V2 本机方案统一成一次请求路由，缺失方案必须在请求前失败。 */
export function resolveAuxiliaryRoute(input: Readonly<Record<string, unknown>>): AuxiliaryRoute {
  const modelSource = isRecord(input.modelSource) ? input.modelSource : { kind: 'tavern-current' };
  const legacyModel =
    modelSource.kind === 'tavern-current' && typeof modelSource.legacyModelOverride === 'string'
      ? modelSource.legacyModelOverride
      : undefined;
  const profile = modelSource.kind === 'custom-profile' ? requireProfile(modelSource.profileId) : null;
  const model =
    modelSource.kind === 'custom-profile' && typeof modelSource.model === 'string' && modelSource.model.length > 0
      ? modelSource.model
      : legacyModel;
  if (profile !== null && !model) {
    throw new TypeError('ERA_AGENT_MODEL_REQUIRED：自定义连接方案必须选择或填写模型。');
  }
  return { profile, model };
}

/** 必须只在 Host 最内层展开 URL 与密钥，否则私密值会越过 Service DTO 边界。 */
export function auxiliaryApiSettings(
  route: AuxiliaryRoute,
  settings: Record<string, unknown>,
): GenerateRawConfig['custom_api'] {
  return {
    ...(route.profile
      ? {
          apiurl: route.profile.apiUrl,
          ...(route.profile.key ? { key: route.profile.key } : {}),
          model: route.model,
          source: 'openai' as const,
        }
      : route.model
        ? { model: route.model }
        : {}),
    max_tokens: numericSetting(settings, 'maxTokens'),
    temperature: numericSetting(settings, 'temperature'),
    frequency_penalty: numericSetting(settings, 'frequencyPenalty'),
    presence_penalty: numericSetting(settings, 'presencePenalty'),
    top_p: numericSetting(settings, 'topP'),
    top_k: numericSetting(settings, 'topK'),
  };
}
