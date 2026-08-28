/*
 * 模块职责：组合 Agent 面板状态、阶段动作、连接方案动作与会话重试视图。
 * 模块边界：具体持久化分散在两个动作类中，本入口只建立页面实例并绑定方法。
 */

import toastr from 'toastr';
import { computed } from 'vue';

import { requestEraService } from '../../../service/client';
import { ERA_UI_EVENT } from '../../../service/types';
import { awaitUiSettlement } from '../../utils/service-settlement';
import { AgentConnectionActions } from './agent-connection-actions';
import { createAgentPanelState } from './agent-panel-state';
import { AgentStageActions } from './agent-stage-actions';

/** 必须按组件实例创建并绑定动作对象，否则方法解构会丢失 this，密钥草稿也可能跨挂载复用。 */
export function useAgentOrchestrationPanel() {
  const state = createAgentPanelState();
  const stage = new AgentStageActions(state);
  const connection = new AgentConnectionActions(state);

  const sessionStatus = computed(() => {
    if (state.groupChat.value) return '群聊不支持';
    if (!state.session.value) return '无活动会话';
    return state.session.value.status === 'unsettled' ? '变量未结算' : String(state.session.value.status ?? '处理中');
  });

  function sessionStageEnabled(kind: 'planning' | 'settlement'): boolean {
    const value = state.session.value?.configuration;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return state.configuration[kind].enabled;
    const candidate = (value as Record<string, unknown>)[kind];
    return Boolean(
      candidate &&
      typeof candidate === 'object' &&
      !Array.isArray(candidate) &&
      (candidate as Record<string, unknown>).enabled === true,
    );
  }

  const retryPlanningEnabled = computed(() => sessionStageEnabled('planning'));
  const retrySettlementEnabled = computed(() => sessionStageEnabled('settlement'));

  async function retry(kind: 'planning' | 'story' | 'settlement'): Promise<void> {
    if (state.busy.value) return;
    state.busy.value = true;
    try {
      await awaitUiSettlement(requestEraService(ERA_UI_EVENT.AGENT_RETRY, [{ kind }], 'ui'), '重试故事编排阶段');
      toastr.success('最新 Agent 周期已按所选阶段级联重试。');
      state.busy.value = false;
      await stage.load();
    } catch (error) {
      toastr.error(`重试失败：${String(error)}`);
    } finally {
      state.busy.value = false;
    }
  }

  return {
    ...state,
    addAttempt: stage.addAttempt.bind(stage),
    clearConnectionKey: connection.clearConnectionKey.bind(connection),
    connectionMissing: stage.connectionMissing.bind(stage),
    deleteConnectionProfile: connection.deleteConnectionProfile.bind(connection),
    editConnectionProfile: connection.editConnectionProfile.bind(connection),
    legacyModel: stage.legacyModel.bind(stage),
    load: stage.load.bind(stage),
    loadModels: connection.loadModels.bind(connection),
    modelsFor: stage.modelsFor.bind(stage),
    presetLabel: stage.presetLabel.bind(stage),
    presetSelection: stage.presetSelection.bind(stage),
    refreshSources: stage.refreshSources.bind(stage),
    removeAttempt: stage.removeAttempt.bind(stage),
    resetProfileDraft: connection.resetProfileDraft.bind(connection),
    retry,
    retryPlanningEnabled,
    retrySettlementEnabled,
    save: stage.save.bind(stage),
    saveConnectionProfile: connection.saveConnectionProfile.bind(connection),
    selectConnectionProfile: stage.selectConnectionProfile.bind(stage),
    selectModelSource: stage.selectModelSource.bind(stage),
    selectPreset: stage.selectPreset.bind(stage),
    sessionStatus,
    toggle: stage.toggle.bind(stage),
  };
}
