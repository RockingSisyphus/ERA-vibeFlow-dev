/**
 * ERA 生产入口。
 *
 * 此文件只装配 Service Host、永久 workflow、同步宏 adapter 和 Vue UI。
 * 旧 scheduler/dispatcher 仅作为冻结差分 oracle 保留，不再进入生产依赖图。
 */

'use strict';

import { createWorkflowHost } from '@era/vibeflow-service';
import { INPUT_EVENT } from './events/catalog';
import { startEraMacroSubsystem } from './macro/parser';
import {
  startEraApplication,
  type EraAppRuntime,
  type EraApplicationDependencies,
  type EraPageLifecycleTarget,
} from './service/lifecycle';
import { TavernEraServiceAdapter } from './service/tavern-adapter';
import type { EraAdmissionResult, EraWorkflowHost } from './service/types';
import { startEraUi } from './ui';
import { initEraSettings } from './utils/era_data';
import { Logger } from './utils/log';

const logger = new Logger();

function warnAdmission(result: EraAdmissionResult, label: string): void {
  if (result.accepted) return;
  logger.warn('warnAdmission', `${label}未被 ERA Service 接纳。`, {
    code: result.code,
    message: result.message,
  });
}

/** 变量提交后必须同步刷新响应式设置，否则 UI 会继续显示旧值。 */
function dispatchSettingsUpdated(): void {
  window.dispatchEvent(new CustomEvent('era-settings-updated'));
}

function productionDependencies(): EraApplicationDependencies {
  return {
    globals: globalThis as unknown as Record<string, unknown>,
    pageTarget: window as unknown as EraPageLifecycleTarget,
    startupEventType: INPUT_EVENT.APP_READY,
    createAdapter: options => new TavernEraServiceAdapter(options),
    createHost: () => createWorkflowHost() as EraWorkflowHost,
    startMacro: startEraMacroSubsystem,
    startUi: startEraUi,
    refreshSettings: initEraSettings,
    dispatchSettingsUpdated,
    warnAdmission,
    warnStop: error => logger.warn('stopRuntime', 'ERA 服务停止期间收到非预期异常。', error),
    reportFatal: error => {
      logger.error('servicePromise', 'ERA 永久工作流非预期停止，已停止接受新命令。', error);
      toastr.error('ERA 服务已进入致命状态，请整页重载并执行一致性扫描。', 'ERA 服务停止');
    },
  };
}

export function startEraRuntime(): Promise<EraAppRuntime> {
  return startEraApplication(productionDependencies());
}

$(() => {
  void startEraRuntime().catch(error => {
    logger.error('startRuntime', 'ERA 生产入口启动失败。', error);
    toastr.error('ERA 服务启动失败，请查看 Console。', 'ERA 启动失败');
  });
});
