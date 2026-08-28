/*
 * 模块职责：定义 Agent 面板的页面实例状态与无副作用的配置收窄函数。
 * 模块边界：不发 Service 请求、不显示通知，也不持有 Tavern 宿主对象。
 */

import { reactive, ref, toRaw } from 'vue';

import type { awaitUiSettlement } from '../../utils/service-settlement';

/** 角色卡可携带的脱敏预设快照，只包含有序提示与通用采样参数。 */
export type PresetSnapshot = { source: 'snapshot'; sourceName?: string; orderedPrompts: unknown[]; settings?: object };
export type TavernModelSource = { kind: 'tavern-current'; legacyModelOverride?: string };
/** 角色卡只保存本机方案引用和模型名，不保存连接地址或 API 密钥。 */
export type CustomModelSource = {
  kind: 'custom-profile';
  profileId: string;
  profileNameHint?: string;
  model?: string;
};
export type Profile = {
  preset: { source: 'builtin' } | PresetSnapshot;
  modelSource: TavernModelSource | CustomModelSource;
};
/** 单个辅助阶段的开关、有限重试次数以及逐次尝试配置。 */
export type Stage = { enabled: boolean; retryCount: number; attempts: Profile[] };
/** 角色卡 V2 故事编排配置，规划和结算阶段保持完全独立。 */
export type Configuration = { schemaVersion: '2'; planning: Stage; settlement: Stage };
/** Host 返回给 UI 的本机方案脱敏摘要，hasKey 只表示是否已保存。 */
export type ConnectionSummary = { id: string; name: string; apiUrl: string; hasKey: boolean };

function blankStage(): Stage {
  return {
    enabled: false,
    retryCount: 3,
    attempts: [{ preset: { source: 'builtin' }, modelSource: { kind: 'tavern-current' } }],
  };
}

/** 每次组件挂载必须创建独立状态，否则未保存的密钥草稿可能跨角色卡残留。 */
export function createAgentPanelState() {
  return {
    configuration: reactive<Configuration>({
      schemaVersion: '2',
      planning: blankStage(),
      settlement: blankStage(),
    }),
    open: ref(false),
    busy: ref(false),
    regexEnabled: ref(true),
    groupChat: ref(false),
    session: ref<Record<string, unknown> | null>(null),
    presetNames: ref<string[]>([]),
    currentPresetName: ref(''),
    connectionProfiles: ref<ConnectionSummary[]>([]),
    modelLists: reactive<Record<string, string[]>>({}),
    profileDraft: reactive({ id: '', name: '', apiUrl: '', key: '' }),
  };
}

export type AgentPanelState = ReturnType<typeof createAgentPanelState>;

/** 将宿主回执的 unknown 收窄为 UI 可读取对象，数组和标量按空对象处理。 */
export function settlementValue(settlement: Awaited<ReturnType<typeof awaitUiSettlement>>): Record<string, unknown> {
  const value = settlement.value;
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function eventValue(event: Event): string {
  return event.target instanceof HTMLSelectElement ? event.target.value : '';
}

/** 兼容 V1 回读，但立即补齐 V2 modelSource，避免模板访问缺失联合字段。 */
export function assignConfiguration(state: AgentPanelState, value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  Object.assign(state.configuration, structuredClone(value) as Configuration);
  for (const stage of [state.configuration.planning, state.configuration.settlement]) {
    if (!Array.isArray(stage.attempts) || stage.attempts.length === 0) {
      stage.attempts = [{ preset: { source: 'builtin' }, modelSource: { kind: 'tavern-current' } }];
    }
    for (const profile of stage.attempts) profile.modelSource ??= { kind: 'tavern-current' };
  }
}

/** 必须只接受公开摘要字段，否则连接密钥可能通过异常 Host 回执进入 UI 状态。 */
export function assignSources(state: AgentPanelState, value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const source = value as Record<string, unknown>;
  state.presetNames.value = Array.isArray(source.presetNames)
    ? source.presetNames.filter((item): item is string => typeof item === 'string')
    : [];
  state.currentPresetName.value = typeof source.currentPresetName === 'string' ? source.currentPresetName : '';
  state.connectionProfiles.value = Array.isArray(source.connectionProfiles)
    ? source.connectionProfiles.filter((item): item is ConnectionSummary =>
        Boolean(
          item &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          typeof (item as ConnectionSummary).id === 'string',
        ),
      )
    : [];
}

/** 写入前统一施加 V2 有界约束，防止角色卡携带无界重试或空白路由。 */
export function boundedConfiguration(state: AgentPanelState): Configuration {
  const next = structuredClone(toRaw(state.configuration));
  for (const stage of [next.planning, next.settlement]) {
    stage.retryCount = Math.max(0, Math.min(16, Number.isFinite(stage.retryCount) ? Math.trunc(stage.retryCount) : 3));
    stage.attempts = stage.attempts.slice(0, 17).map(profile => {
      const modelSource = structuredClone(profile.modelSource);
      if (modelSource.kind === 'custom-profile') {
        modelSource.profileId = modelSource.profileId.trim();
        modelSource.model = modelSource.model?.trim() || undefined;
        modelSource.profileNameHint = modelSource.profileNameHint?.trim() || undefined;
      }
      return { preset: profile.preset, modelSource };
    });
  }
  return next;
}
