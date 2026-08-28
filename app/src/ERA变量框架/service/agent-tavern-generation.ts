/*
 * 模块职责：把 Agent 辅助阶段的模型来源解析成 generateRaw 请求与脱敏路由证据。
 * 模块边界：不执行网络请求、不读取角色卡，只在 Host 内部短暂展开本机密钥。
 */

import { isRecord, requireProfile, type LocalConnectionProfile } from './agent-tavern-configuration';

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
