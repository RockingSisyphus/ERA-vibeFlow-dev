/*
 * 模块职责：管理 ERA 本机连接方案、模型列表和密钥草稿。
 * 模块边界：只通过 Service 操作本机扩展设置，绝不把密钥写入角色卡配置。
 */

import toastr from 'toastr';
import { toRaw } from 'vue';

import { requestEraService } from '../../../service/client';
import { ERA_UI_EVENT } from '../../../service/types';
import { awaitUiSettlement } from '../../utils/service-settlement';
import {
  assignSources,
  eventValue,
  settlementValue,
  type AgentPanelState,
  type ConnectionSummary,
  type Profile,
} from './agent-panel-state';

/** 所有方案操作共享 busy 锁；失败时必须保留用户原草稿以便修正后重试。 */
export class AgentConnectionActions {
  constructor(private readonly state: AgentPanelState) {}

  /** 模型枚举失败时必须保留原选择，空列表只接受成功回执。 */
  async loadModels(profile: Profile): Promise<void> {
    if (this.state.busy.value || profile.modelSource.kind !== 'custom-profile' || !profile.modelSource.profileId)
      return;
    this.state.busy.value = true;
    try {
      const result = await awaitUiSettlement(
        requestEraService(
          ERA_UI_EVENT.AGENT_CONFIGURATION,
          [{ action: 'list-connection-models', id: profile.modelSource.profileId }],
          'ui',
        ),
        '加载模型列表',
      );
      const payload = settlementValue(result).result;
      const models =
        payload && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as Record<string, unknown>).models
          : null;
      this.state.modelLists[profile.modelSource.profileId] = Array.isArray(models)
        ? models.filter((item): item is string => typeof item === 'string')
        : [];
    } catch (error) {
      toastr.error(`加载模型失败：${String(error)}`);
    } finally {
      this.state.busy.value = false;
    }
  }

  resetProfileDraft(): void {
    Object.assign(this.state.profileDraft, { id: '', name: '', apiUrl: '', key: '' });
  }

  editConnectionProfile(event: Event): void {
    const id = eventValue(event);
    const profile = this.state.connectionProfiles.value.find(item => item.id === id);
    if (!profile) this.resetProfileDraft();
    else
      Object.assign(this.state.profileDraft, { id: profile.id, name: profile.name, apiUrl: profile.apiUrl, key: '' });
  }

  /** 必须把空密钥解释为保留已有值，否则编辑名称会意外删除本机密钥。 */
  async saveConnectionProfile(): Promise<void> {
    if (this.state.busy.value) return;
    this.state.busy.value = true;
    try {
      const value = await this.profileAction(
        { action: 'upsert-connection-profile', profile: { ...toRaw(this.state.profileDraft) } },
        '保存本机连接方案',
      );
      const result = value.result;
      const profile =
        result && typeof result === 'object' && !Array.isArray(result)
          ? (result as Record<string, unknown>).profile
          : null;
      if (profile && typeof profile === 'object' && !Array.isArray(profile)) {
        const summary = profile as ConnectionSummary;
        Object.assign(this.state.profileDraft, {
          id: summary.id,
          name: summary.name,
          apiUrl: summary.apiUrl,
          key: '',
        });
      }
      toastr.success('连接方案已保存在本机；角色卡只会保存方案引用。');
    } catch (error) {
      toastr.error(`保存连接方案失败：${String(error)}`);
    } finally {
      this.state.busy.value = false;
    }
  }

  /** 清除密钥经独立动作完成，避免编辑表单中的空字符串产生歧义。 */
  async clearConnectionKey(): Promise<void> {
    if (this.state.busy.value || !this.state.profileDraft.id) return;
    this.state.busy.value = true;
    try {
      await this.profileAction(
        { action: 'clear-connection-profile-key', id: this.state.profileDraft.id },
        '清除本机 API 密钥',
      );
      this.state.profileDraft.key = '';
      toastr.success('本机 API 密钥已清除。');
    } catch (error) {
      toastr.error(`清除密钥失败：${String(error)}`);
    } finally {
      this.state.busy.value = false;
    }
  }

  /** 删除后必须保留角色卡引用，否则用户无法看到需要重新绑定的明确诊断。 */
  async deleteConnectionProfile(): Promise<void> {
    if (this.state.busy.value || !this.state.profileDraft.id) return;
    this.state.busy.value = true;
    try {
      await this.profileAction(
        { action: 'delete-connection-profile', id: this.state.profileDraft.id },
        '删除本机连接方案',
      );
      this.resetProfileDraft();
      toastr.success('本机连接方案已删除；引用它的角色卡会明确提示需要重新绑定。');
    } catch (error) {
      toastr.error(`删除连接方案失败：${String(error)}`);
    } finally {
      this.state.busy.value = false;
    }
  }

  private async profileAction(payload: Record<string, unknown>, label: string): Promise<Record<string, unknown>> {
    const result = await awaitUiSettlement(requestEraService(ERA_UI_EVENT.AGENT_CONFIGURATION, [payload], 'ui'), label);
    const value = settlementValue(result);
    assignSources(this.state, value.sources);
    return value;
  }
}
