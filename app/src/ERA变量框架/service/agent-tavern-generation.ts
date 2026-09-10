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

/** 必须在请求时读取实际本机方案以保留连接执行语义；只绑定 Service 已选择的模型意图。 */
export function resolveAuxiliaryRoute(input: Readonly<Record<string, unknown>>): AuxiliaryRoute {
  const policy = input.requestPolicy as { binding: { kind: string; profileId: unknown; model: string | null } };
  const binding = policy.binding;
  const profile = binding.kind === 'custom-profile' ? requireProfile(binding.profileId) : null;
  const model = binding.model ?? undefined;
  if (profile !== null && !model) {
    throw new TypeError('ERA_AGENT_MODEL_REQUIRED：自定义连接方案必须选择或填写模型。');
  }
  return { profile, model };
}

/** 必须只在 Host 最内层展开 URL 与密钥，否则私密值会越过 Service DTO 边界。 */
export function auxiliaryApiSettings(
  route: AuxiliaryRoute,
  settings: Readonly<Record<string, number | 'same_as_preset'>>,
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
    max_tokens: settings.maxTokens,
    temperature: settings.temperature,
    frequency_penalty: settings.frequencyPenalty,
    presence_penalty: settings.presencePenalty,
    top_p: settings.topP,
    top_k: settings.topK,
  };
}
