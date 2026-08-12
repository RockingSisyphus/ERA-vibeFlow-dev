/**
 * @file ERA 变量框架 - 生产环境事件队列
 * @description
 * 本文件只负责组装唯一的 EventScheduler 实例，并向入口暴露精简 API。
 * 批次、Ticket、合并和 worker 生命周期都封装在 scheduler 中；领域行为仍交给 dispatcher。
 */

'use strict';

import { Logger } from '../utils/log';
import { dispatchAndExecuteTask } from './dispatcher';
import { EventScheduler } from './scheduler';
import type { EventReceipt } from './types';

const logger = new Logger();

export const eventScheduler = new EventScheduler({
  executor: (task, context) => dispatchAndExecuteTask(task, context),
  onWatchdog: ({ throughSequence, pendingSequences, elapsedMs }) => {
    logger.warn(
      'waitThrough',
      `生成栅栏等待已超过 ${elapsedMs}ms，仍在等待事件序号：${pendingSequences.join(', ')}。ERA 将继续等待，不会用固定超时伪装同步成功。`,
      { throughSequence, pendingSequences },
    );
  },
  onWorkerError: error => {
    logger.error('EventScheduler', '事件任务执行失败；对应 Ticket 将以 failed 结算。', error);
  },
  onNotificationError: error => {
    logger.error('EventScheduler', '状态已提交，但后置通知执行失败。', error);
  },
});

/**
 * 将酒馆事件的全部参数原样交给调度器。
 * 入口应使用 `enqueueEvent(type, ...args)`，而不是只截取第一个 detail。
 */
export function enqueueEvent(type: string, ...args: unknown[]): EventReceipt<unknown> {
  logger.debug('enqueueEvent', `接收到事件：${type}`, { args });
  return eventScheduler.enqueue(type, args);
}

/** pagehide 时取消尚未完成的 Ticket，并阻止新任务进入。 */
export function disposeEventQueue(reason?: string): void {
  eventScheduler.dispose(reason);
}
