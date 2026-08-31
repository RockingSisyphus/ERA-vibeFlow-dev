/*
 * 模块职责：管理每张规划/结算尝试卡内联的连接草稿、模型枚举与显式删除。
 * 模块边界：密码只以页面实例闭包作为宿主引用提交；任何公开 payload 都不包含密码正文。
 */

import toastr from 'toastr';

import { requestEraService } from '../../../service/client';
import { ERA_UI_EVENT } from '../../../service/types';
import { awaitUiSettlement } from '../../utils/service-settlement';
import {
  assignSources,
  connectionDraft,
  settlementValue,
  type AgentPanelState,
  type AgentStageName,
  type ConnectionDraft,
} from './agent-panel-state';

export class AgentConnectionActions {
  constructor(private readonly state: AgentPanelState) {}

  draft(stage: AgentStageName, index: number): ConnectionDraft {
    return connectionDraft(this.state, stage, index);
  }

  /** 为了防止秘密跨尝试扩散，复制和显式新建都建立空白、未绑定草稿。 */
  newConnection(stage: AgentStageName, index: number): void {
    const profile = this.state.configuration[stage].attempts[index];
    profile.modelSource = { kind: 'custom-profile', profileId: '', model: '' };
    this.state.connectionDrafts[stage][index] = {
      boundProfileId: '',
      name: '',
      apiUrl: '',
      key: '',
      clearKey: false,
      saveAs: false,
      models: [],
    };
  }

  /** 只有草稿未改变路由或秘密时才能按 ID 加载，否则必须以当前草稿为准。 */
  private canUseSavedProfile(draft: ConnectionDraft): boolean {
    return (
      draft.boundProfileId.length > 0 &&
      !draft.saveAs &&
      draft.key.length === 0 &&
      !draft.clearKey &&
      this.state.connectionProfiles.value.some(item => item.id === draft.boundProfileId && item.apiUrl === draft.apiUrl)
    );
  }

  /** 模型加载失败只显示诊断，避免清空既有模型列表或用户已选模型。 */
  async loadModels(stage: AgentStageName, index: number): Promise<void> {
    if (this.state.busy.value) return;
    const profile = this.state.configuration[stage].attempts[index];
    if (profile.modelSource.kind !== 'custom-profile') return;
    const draft = this.draft(stage, index);
    this.state.busy.value = true;
    try {
      // 未保存的地址或密码由草稿枚举能力处理，避免为了查看模型而提前写入本机方案。
      const canUseSaved = this.canUseSavedProfile(draft);
      const secret = draft.key;
      const payload = canUseSaved
        ? { action: 'list-connection-models', id: draft.boundProfileId }
        : {
            action: 'list-connection-models-draft',
            apiUrl: draft.apiUrl,
            ...(secret ? { keyArgIndex: 1 } : {}),
          };
      const result = await awaitUiSettlement(
        requestEraService(
          ERA_UI_EVENT.AGENT_CONFIGURATION,
          secret && !canUseSaved ? [payload, () => secret] : [payload],
          'ui',
        ),
        '加载模型列表',
      );
      const hostResult = settlementValue(result).result;
      // 收窄 Host 返回值，防止异常对象被模板当作模型名称渲染。
      const models =
        hostResult && typeof hostResult === 'object' && !Array.isArray(hostResult)
          ? (hostResult as Record<string, unknown>).models
          : null;
      if (!Array.isArray(models)) throw new TypeError('Host 未返回模型列表。');
      const normalized = models.filter((item): item is string => typeof item === 'string');
      if (normalized.length > 0) {
        draft.models = normalized;
        toastr.success(`已加载 ${normalized.length} 个模型。`);
      } else {
        toastr.info('连接成功，但提供器返回了空模型列表；已保留当前模型选择。');
      }
    } catch (error) {
      toastr.error(`加载模型失败：${String(error)}`);
    } finally {
      this.state.busy.value = false;
    }
  }

  /** 删除后保留角色卡引用，避免静默改用另一连接；面板必须明确呈现“需要重新绑定”。 */
  async deleteConnectionProfile(stage: AgentStageName, index: number): Promise<void> {
    if (this.state.busy.value) return;
    const draft = this.draft(stage, index);
    if (!draft.boundProfileId) return;
    if (!window.confirm(`删除本机连接方案“${draft.name || draft.boundProfileId}”？角色卡引用会保留并等待重新绑定。`)) {
      return;
    }
    this.state.busy.value = true;
    try {
      // 删除只作用于本机库；角色卡引用必须继续可见，以便用户显式重新绑定。
      const result = await awaitUiSettlement(
        requestEraService(
          ERA_UI_EVENT.AGENT_CONFIGURATION,
          [{ action: 'delete-connection-profile', id: draft.boundProfileId }],
          'ui',
        ),
        '删除本机连接方案',
      );
      assignSources(this.state, settlementValue(result).sources);
      toastr.success('本机连接方案已删除；当前尝试会显示需要重新绑定。');
    } catch (error) {
      toastr.error(`删除连接方案失败：${String(error)}`);
    } finally {
      this.state.busy.value = false;
    }
  }
}
