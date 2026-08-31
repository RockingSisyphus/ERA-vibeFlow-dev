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
/** 角色卡 V2 多阶段生成配置，规划和结算阶段保持完全独立。 */
export type Configuration = { schemaVersion: '2'; planning: Stage; settlement: Stage };
/** Host 返回给 UI 的本机方案脱敏摘要，hasKey 只表示是否已保存。 */
export type ConnectionSummary = { id: string; name: string; apiUrl: string; hasKey: boolean };
/** 页面实例内的连接草稿；key 和模型枚举不得进入角色卡配置或跨角色复用。 */
export type ConnectionDraft = {
  boundProfileId: string;
  name: string;
  apiUrl: string;
  key: string;
  clearKey: boolean;
  saveAs: boolean;
  models: string[];
};
export type AgentStageName = 'planning' | 'settlement';

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
    groupChat: ref(false),
    session: ref<Record<string, unknown> | null>(null),
    presetNames: ref<string[]>([]),
    currentPresetName: ref(''),
    connectionProfiles: ref<ConnectionSummary[]>([]),
    connectionDrafts: reactive<Record<AgentStageName, ConnectionDraft[]>>({ planning: [], settlement: [] }),
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
  resetConnectionDrafts(state);
}

function draftForProfile(state: AgentPanelState, profile: Profile): ConnectionDraft {
  const id = profile.modelSource.kind === 'custom-profile' ? profile.modelSource.profileId : '';
  const summary = state.connectionProfiles.value.find(item => item.id === id);
  return {
    boundProfileId: id,
    name:
      summary?.name ??
      (profile.modelSource.kind === 'custom-profile' ? (profile.modelSource.profileNameHint ?? '') : ''),
    apiUrl: summary?.apiUrl ?? '',
    key: '',
    clearKey: false,
    saveAs: false,
    models: [],
  };
}

/** 重读角色或来源时清空所有密码草稿，防止未保存密钥跨角色或聊天残留。 */
export function resetConnectionDrafts(state: AgentPanelState): void {
  for (const stage of ['planning', 'settlement'] as const) {
    state.connectionDrafts[stage].splice(
      0,
      state.connectionDrafts[stage].length,
      ...state.configuration[stage].attempts.map(profile => draftForProfile(state, profile)),
    );
  }
}

/**
 * 按当前尝试的方案引用返回草稿；引用变化时必须重建，否则会把上一方案的密码带入新方案。
 */
export function connectionDraft(state: AgentPanelState, stage: AgentStageName, index: number): ConnectionDraft {
  const profile = state.configuration[stage].attempts[index];
  if (!profile) throw new RangeError('多阶段生成尝试序号不存在。');
  const expectedId = profile.modelSource.kind === 'custom-profile' ? profile.modelSource.profileId : '';
  const current = state.connectionDrafts[stage][index];
  if (!current || current.boundProfileId !== expectedId) {
    state.connectionDrafts[stage][index] = draftForProfile(state, profile);
  }
  return state.connectionDrafts[stage][index];
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
        const model = modelSource.model?.trim();
        const profileNameHint = modelSource.profileNameHint?.trim();
        if (model) modelSource.model = model;
        else delete modelSource.model;
        if (profileNameHint) modelSource.profileNameHint = profileNameHint;
        else delete modelSource.profileNameHint;
      }
      return { preset: profile.preset, modelSource };
    });
  }
  return next;
}
