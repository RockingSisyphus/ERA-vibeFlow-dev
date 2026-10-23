/**
 * @file ERA角色卡脚本入口与页面呈现
 * @description 组织Tavern展示端口并调用一次原生workflow；资源Node拥有监听、实际任务及卸载收尾。
 * 主Service返回启动回执后才安装宏与页面展示，错误提示读取已经完成的处理结果。
 */
'use strict';

import { runWorkflowAsync as service } from '@era/vibeflow-service';
import { runEra } from '@era/vibeflow-tavern';
import { runWorkflow as sync } from '@era/vibeflow-tavern-sync';
import { runWorkflowAsync as asyncEntry } from '@era/vibeflow-tavern-async';
import { INPUT_EVENT, EVENT_CATALOG } from './events/catalog';
import { agentExecutionRecords, type AgentRequestContext } from './service/agent-execution-records';
import { observeAgentReceipt, observeAgentSession } from './service/agent-session-observation';
import { readCurrentAgentSession, installEraServiceClient, type EraNativeClient } from './service/client';
import { refreshExternalStatusbarSelection } from './service/external-statusbar-configuration';
import { createFunctionFacade, installEraPublicApi } from './service/public-api';
import {
  clearSidecarRuntimeSnapshot,
  publishSidecarRuntimeSnapshot,
  storeWorkingState,
} from './service/sidecar-runtime-snapshot';
import { refreshSingleFloorSelection } from './service/single-floor-configuration';
import { verifyEraStatusbarCommitSource, createEraStatusbarRuntime } from './service/statusbar-runtime';
import {
  refreshDisplayedEraTechnicalBlocks,
  registerEraTechnicalBlockProjection,
} from './service/technical-block-projection';
import type { EraStartupGateDecision, EraWaitThroughResult } from './service/types';
import { initEraSettings } from './utils/era_data';
import { Logger } from './utils/log';

import { startEraMacroSubsystem } from './macro/subsystem';
import { startEraUi } from './ui';
import { startExternalStatusbar } from './ui/external-statusbar';
import { startSingleFloor } from './service/single-floor-runtime';

const logger = new Logger();

/** 等待启动回执后挂载宏与页面展示；卸载若先发生，信号检查阻止旧续体晚挂载。
 * 部分挂载失败会释放已创建的展示，返回的释放器由辅助workflow资源Node持有。 */
export async function mountEraPresentation(client: EraNativeClient, signal: AbortSignal): Promise<() => void> {
  const releases: Array<() => void> = [];
  const release = () => {
    const errors: unknown[] = [];
    for (const cleanup of releases.splice(0).reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'ERA 展示资源释放失败。');
  };
  try {
    signal.throwIfAborted();
    releases.push(installEraServiceClient(client));
    releases.push(installEraPublicApi(createEraStatusbarRuntime));
    const admission = client.enqueue(INPUT_EVENT.APP_READY, 'tavern', []);
    if (admission.accepted)
      await admission.done.catch(error => new Logger().warn('startupAdmission', '启动回执异常。', error));
    else new Logger().warn('startupAdmission', '启动初始化事件未被接纳。', admission);
    signal.throwIfAborted();
    initEraSettings();
    releases.push(startEraMacroSubsystem());
    const ui = startEraUi();
    releases.push(() => ui.stop());
    releases.push(startExternalStatusbar());
    releases.push(startSingleFloor());
    return release;
  } catch (error) {
    release();
    if (signal.aborted) return () => undefined;
    throw error;
  }
}

/** 呈现生成屏障的已结算失败；耗尽规划尝试由主Service阻断，此处只区分用户提示。 */
function reportBarrierFailure(result: EraWaitThroughResult): void {
  if (!result.hasFailures) return;
  const exhausted = result.outcomes.some(
    ({ outcome }) =>
      outcome.status === 'failed' &&
      typeof outcome.error === 'object' &&
      outcome.error !== null &&
      'code' in outcome.error &&
      outcome.error.code === 'ERA_AGENT_PLANNING_EXHAUSTED',
  );
  if (exhausted) logger.warn('generationBarrier', 'Agent规划尝试耗尽，原生故事生成已按会话合同阻断。', result);
  else {
    logger.error('generationBarrier', '生成前ERA状态任务执行失败，按现有合同结束屏障等待。', result);
    toastr.error('ERA生成前状态同步失败，本次请求可能读到旧变量；请查看Console。', 'ERA生成栅栏');
  }
}
/** 展示主Service给出的安装位置决议，保持角色卡局部脚本的提示语义。 */
function reportStartup(decision: EraStartupGateDecision): void {
  if (!decision.warn) return;
  toastr.warning(
    decision.route === 'dormant'
      ? 'ERA必须作为角色卡脚本安装，请移除全局脚本或预设脚本中的ERA副本。'
      : 'ERA无法确认当前脚本安装位置，已按兼容模式启动。',
    'ERA安装位置',
  );
}
/** 将模型调用事实送入有界的查看仓库；不改变生成顺序或回执。 */
function observeRequest(
  status: 'begin' | 'responded' | 'failed',
  value: {
    id: string;
    chat: string;
    stage: string;
    input?: unknown;
    hostConfiguration?: unknown;
    requestContext?: AgentRequestContext;
    response?: string;
  },
): void {
  if (status === 'begin')
    agentExecutionRecords.begin(
      value.id,
      value.chat,
      value.stage,
      value.input,
      value.hostConfiguration,
      value.requestContext,
    );
  else agentExecutionRecords.finish(value.id, status, value.response);
}

/** 为了保持单次入口与资源归属，只配置展示端口并调用辅助workflow，不保存运行实例或提供停止管理。
 * 测试Loader必须等旧实例完成清理后再复用入口，避免反复导入整份模块而累积浏览器缓存。 */
export function runEraScript(): Promise<unknown> {
  const completion = runEra(
    { sync, async: asyncEntry, service },
    {
      eventDefinitions: [...EVENT_CATALOG.values()],
      onActivated: (client: EraNativeClient, signal: AbortSignal) => {
        Reflect.set(globalThis, '__ERA_VIBEFLOW_NATIVE_COMPLETION__', completion);
        return mountEraPresentation(client, signal);
      },
      onStartupDecision: reportStartup,
      onBarrierFailure: reportBarrierFailure,
      createFunctionFacade,
      publishSnapshot: publishSidecarRuntimeSnapshot,
      storeWorkingState,
      verifyStatusbarSource: verifyEraStatusbarCommitSource,
      projectTechnicalBlocks: refreshDisplayedEraTechnicalBlocks,
      registerTechnicalProjection: registerEraTechnicalBlockProjection,
      refreshSingleFloor: refreshSingleFloorSelection,
      refreshExternalStatusbar: refreshExternalStatusbarSelection,
      observeAgentSession,
      observeAgentRequest: observeRequest,
      observeSettlement: (done: Parameters<typeof observeAgentReceipt>[0]) =>
        observeAgentReceipt(done, readCurrentAgentSession),
      agentRecordView: agentExecutionRecords,
      /** 脚本变量提交后才刷新设置镜像并通知页面，避免显示尚未提交的修改。 */
      onScriptVariablesCommitted: () => {
        initEraSettings();
        window.dispatchEvent(new CustomEvent('era-settings-updated'));
      },
      onDispose: () => {
        if (Reflect.get(globalThis, '__ERA_VIBEFLOW_NATIVE_COMPLETION__') === completion)
          Reflect.deleteProperty(globalThis, '__ERA_VIBEFLOW_NATIVE_COMPLETION__');
        clearSidecarRuntimeSnapshot();
        agentExecutionRecords.clear();
      },
    },
  );
  void completion.catch(error => {
    logger.error('nativeEra', 'ERA原生流程异常退出，任务和资源已完成收尾。', error);
    toastr.error('ERA服务异常退出，请查看Console并重载角色脚本。', 'ERA服务停止');
  });
  return completion;
}

$(() => {
  void runEraScript();
});
