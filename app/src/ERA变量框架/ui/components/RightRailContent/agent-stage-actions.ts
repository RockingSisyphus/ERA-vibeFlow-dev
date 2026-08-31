/*
 * 模块职责：管理规划与结算阶段的配置、预设快照和尝试顺序。
 * 模块边界：不管理本机密钥方案的增删改，也不执行 Agent 生成会话。
 */

import toastr from 'toastr';
import { toRaw } from 'vue';

import { requestEraService } from '../../../service/client';
import { ERA_UI_EVENT } from '../../../service/types';
import { awaitUiSettlement } from '../../utils/service-settlement';
import {
  assignConfiguration,
  assignSources,
  boundedConfiguration,
  connectionDraft,
  eventValue,
  settlementValue,
  type AgentPanelState,
  type Profile,
} from './agent-panel-state';

type StageName = 'planning' | 'settlement';

function stageAttemptLabel(stage: StageName, index: number): string {
  return `${stage === 'planning' ? '规划' : '变量解析'}尝试 ${index + 1}`;
}

/** 地址必须在提交 Host 副作用前完整验证，否则前序方案可能已写入而后序草稿才失败。 */
function validatedApiUrl(raw: string, label: string): string {
  const value = raw.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new TypeError(`${label}的 API 地址无效。`, { cause: error });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TypeError(`${label}的 API 地址必须使用 HTTP(S)。`);
  }
  return value;
}

/** 同一方案只能有一份待保存内容，避免尝试顺序暗中决定最终连接配置。 */
function rememberProfileEdit(
  edits: Map<string, string>,
  profileId: string,
  name: string,
  apiUrl: string,
  clearKey: boolean,
  hasNewKey: boolean,
): void {
  const signature = JSON.stringify({ name, apiUrl: apiUrl.replace(/\/+$/u, ''), clearKey, hasNewKey });
  const previous = edits.get(profileId);
  if (previous !== undefined && previous !== signature) {
    throw new TypeError(`同一本机方案“${name}”被多个尝试以不同内容修改；请将其中一项选为“另存为”。`);
  }
  edits.set(profileId, signature);
}

/** 先把单张尝试卡归一化为公开 mutation；密码仍只保留在页面内闭包。 */
function connectionMutation(
  state: AgentPanelState,
  configuration: ReturnType<typeof boundedConfiguration>,
  stage: StageName,
  index: number,
  editedProfiles: Map<string, string>,
): { mutation: Record<string, unknown>; secret: string } | null {
  const profile = configuration[stage].attempts[index];
  if (!profile || profile.modelSource.kind !== 'custom-profile') return null;
  const draft = connectionDraft(state, stage, index);
  const label = stageAttemptLabel(stage, index);
  const name = draft.name.trim();
  if (!name) throw new TypeError(`${label}的方案名称不能为空。`);
  const apiUrl = validatedApiUrl(draft.apiUrl, label);
  if (!profile.modelSource.model?.trim()) throw new TypeError(`${label}尚未选择或填写模型。`);
  if (draft.boundProfileId && !draft.saveAs) {
    rememberProfileEdit(editedProfiles, draft.boundProfileId, name, apiUrl, draft.clearKey, draft.key.length > 0);
  }
  return {
    secret: draft.key,
    mutation: {
      stage,
      index,
      ...(!draft.saveAs && draft.boundProfileId ? { id: draft.boundProfileId } : {}),
      name,
      apiUrl,
      clearKey: draft.clearKey,
    },
  };
}

/** 阶段配置动作必须共享页面 busy 锁，避免保存与预设捕获并发覆盖。 */
export class AgentStageActions {
  constructor(private readonly state: AgentPanelState) {}

  /** 打开面板时必须重读当前角色事实，避免沿用切卡前配置。 */
  async load(): Promise<void> {
    if (this.state.busy.value) return;
    this.state.busy.value = true;
    try {
      const result = await awaitUiSettlement(
        requestEraService(ERA_UI_EVENT.AGENT_CONFIGURATION, [{ action: 'read' }], 'ui'),
        '读取多阶段生成设置',
      );
      const value = settlementValue(result);
      assignConfiguration(this.state, value.configuration);
      assignSources(this.state, value.sources);
      this.state.groupChat.value = value.groupChat === true;
      this.state.session.value =
        value.session && typeof value.session === 'object' ? (value.session as Record<string, unknown>) : null;
    } catch (error) {
      toastr.error(`读取多阶段生成设置失败：${String(error)}`);
    } finally {
      this.state.busy.value = false;
    }
  }

  async toggle(): Promise<void> {
    this.state.open.value = !this.state.open.value;
    if (this.state.open.value) await this.load();
  }

  /** 仅在 Service 回执成功后更新草稿，否则失败写入不得伪装成已保存。 */
  async save(): Promise<void> {
    if (this.state.busy.value || this.state.groupChat.value) return;
    this.state.busy.value = true;
    try {
      const configuration = boundedConfiguration(this.state);
      const secretProviders: Array<() => string> = [];
      const connectionMutations: Record<string, unknown>[] = [];
      const editedProfiles = new Map<string, string>();
      for (const stageName of ['planning', 'settlement'] as const) {
        for (const index of configuration[stageName].attempts.keys()) {
          const prepared = connectionMutation(this.state, configuration, stageName, index, editedProfiles);
          if (!prepared) continue;
          const keyArgIndex = prepared.secret.length > 0 ? secretProviders.push(() => prepared.secret) : 0;
          connectionMutations.push({ ...prepared.mutation, ...(keyArgIndex > 0 ? { keyArgIndex } : {}) });
        }
      }
      const result = await awaitUiSettlement(
        requestEraService(
          ERA_UI_EVENT.AGENT_CONFIGURATION,
          [{ action: 'write-with-connections', configuration, connectionMutations }, ...secretProviders],
          'ui',
        ),
        '保存多阶段生成设置',
      );
      const value = settlementValue(result);
      assignConfiguration(this.state, value.configuration);
      assignSources(this.state, value.sources);
      toastr.success('多阶段生成设置已写入当前角色卡，导出角色卡时会一起携带。');
    } catch (error) {
      toastr.error(`保存失败：${String(error)}`);
    } finally {
      this.state.busy.value = false;
    }
  }

  async selectPreset(stage: 'planning' | 'settlement', index: number, event: Event): Promise<void> {
    const value = eventValue(event);
    if (value === 'builtin') {
      this.state.configuration[stage].attempts[index].preset = { source: 'builtin' };
      return;
    }
    if (value === 'embedded') return;
    await this.capturePreset(stage, index, value === 'in_use' ? 'in_use' : value.replace(/^preset:/u, ''));
  }

  /** 主动切换来源时清除 V1 覆盖值，避免新旧路由同时生效。 */
  selectModelSource(stage: 'planning' | 'settlement', index: number, event: Event): void {
    const profile = this.state.configuration[stage].attempts[index];
    profile.modelSource =
      eventValue(event) === 'custom-profile'
        ? {
            kind: 'custom-profile',
            profileId: this.state.connectionProfiles.value[0]?.id ?? '',
            profileNameHint: this.state.connectionProfiles.value[0]?.name,
            model: '',
          }
        : { kind: 'tavern-current' };
  }

  /** 切换已保存方案时重建无密码草稿，避免沿用上一方案的未保存秘密。 */
  selectConnectionProfile(stage: 'planning' | 'settlement', index: number, event: Event): void {
    const modelSource = this.state.configuration[stage].attempts[index].modelSource;
    if (modelSource.kind !== 'custom-profile') return;
    const id = eventValue(event);
    const summary = this.state.connectionProfiles.value.find(item => item.id === id);
    modelSource.profileId = id;
    modelSource.profileNameHint = summary?.name;
    this.state.connectionDrafts[stage][index] = {
      boundProfileId: id,
      name: summary?.name ?? '',
      apiUrl: summary?.apiUrl ?? '',
      key: '',
      clearKey: false,
      saveAs: false,
      models: [],
    };
  }

  addAttempt(stage: 'planning' | 'settlement'): void {
    if (this.state.configuration[stage].attempts.length >= 17) return;
    const last =
      this.state.configuration[stage].attempts.at(-1) ??
      ({ preset: { source: 'builtin' as const }, modelSource: { kind: 'tavern-current' as const } } satisfies Profile);
    this.state.configuration[stage].attempts.push(structuredClone(toRaw(last)));
    const profile = this.state.configuration[stage].attempts.at(-1);
    if (profile) connectionDraft(this.state, stage, this.state.configuration[stage].attempts.length - 1);
  }

  removeAttempt(stage: 'planning' | 'settlement', index: number): void {
    if (this.state.configuration[stage].attempts.length > 1) {
      this.state.configuration[stage].attempts.splice(index, 1);
      this.state.connectionDrafts[stage].splice(index, 1);
    }
  }

  presetLabel(profile: Profile): string {
    return profile.preset.source === 'builtin'
      ? 'ERA 内建预设'
      : `已嵌入脱敏快照${profile.preset.sourceName ? `：${profile.preset.sourceName}` : ''}`;
  }

  /** 必须只按名称匹配 UI 选项，避免运行时重新解析本机同名预设而改变角色卡语义。 */
  presetSelection(profile: Profile): string {
    if (profile.preset.source === 'builtin') return 'builtin';
    const name = profile.preset.sourceName;
    if (name?.startsWith('当前正在使用（')) return 'in_use';
    return name && this.state.presetNames.value.includes(name) ? `preset:${name}` : 'embedded';
  }

  legacyModel(profile: Profile): string {
    return profile.modelSource.kind === 'tavern-current' ? (profile.modelSource.legacyModelOverride ?? '') : '';
  }

  connectionMissing(profile: Profile): boolean {
    const source = profile.modelSource;
    return (
      source.kind === 'custom-profile' &&
      source.profileId.length > 0 &&
      !this.state.connectionProfiles.value.some(item => item.id === source.profileId)
    );
  }

  /** 刷新失败必须保留旧列表，避免未保存配置被空结果覆盖。 */
  async refreshSources(): Promise<void> {
    if (this.state.busy.value) return;
    this.state.busy.value = true;
    try {
      const result = await awaitUiSettlement(
        requestEraService(ERA_UI_EVENT.AGENT_CONFIGURATION, [{ action: 'read-sources' }], 'ui'),
        '刷新预设与连接方案',
      );
      assignSources(this.state, settlementValue(result).sources);
    } catch (error) {
      toastr.error(`刷新失败：${String(error)}`);
    } finally {
      this.state.busy.value = false;
    }
  }

  /** 捕获完成前保持 busy 锁，避免快速切换把较晚回执写入错误尝试。 */
  private async capturePreset(stage: 'planning' | 'settlement', index: number, name: string): Promise<void> {
    if (this.state.busy.value) return;
    this.state.busy.value = true;
    try {
      const result = await awaitUiSettlement(
        requestEraService(ERA_UI_EVENT.AGENT_CONFIGURATION, [{ action: 'capture-preset', name }], 'ui'),
        '导入预设',
      );
      this.state.configuration[stage].attempts[index].preset = settlementValue(result).preset as Profile['preset'];
      toastr.success('已导入脱敏预设快照；API 地址、密钥、代理、正则与脚本不会写入角色卡。');
    } catch (error) {
      toastr.error(`导入预设失败：${String(error)}`);
    } finally {
      this.state.busy.value = false;
    }
  }
}
