'use strict';

import { ERA_API_EVENTS } from '../../../utils/constants';
import type {
  ActionsTaken,
  ApiTask,
  DispatcherPayload,
  PostCommitNotification,
  TaskExecutionResult,
} from '../../types';
import { emitApiWriteEvent } from '../../emitters/events';
import { handleSyncEvent } from '../sync';
import {
  deleteByObject,
  deleteByPath,
  handleForceSync,
  handleGetCurrentVars,
  handleGetSnapshotAtMId,
  handleGetSnapshotAtMk,
  handleGetSnapshotsBetweenMIds,
  handleGetSnapshotsBetweenMks,
  handleRequestWriteDone,
  insertByObject,
  insertByPath,
  updateByObject,
  updateByPath,
} from './handler';

interface ApiHandlerContext {
  actionsTaken: ActionsTaken;
  payload: DispatcherPayload;
}

async function runPostCommitNotificationsInOrder(notifications: readonly PostCommitNotification[]): Promise<void> {
  // 按数组顺序启动每个通知，但不等待前一个监听器全部结束。
  // 例如旧 apiWrite 监听器可能主动等待 writeDone；若串行 await，两者会形成循环等待。
  const pending = notifications.map(notify => {
    try {
      return Promise.resolve(notify());
    } catch (error) {
      return Promise.reject(error);
    }
  });

  const results = await Promise.allSettled(pending);
  const errors = results.flatMap(result => (result.status === 'rejected' ? [result.reason] : []));
  if (errors.length > 0) {
    throw new AggregateError(errors, 'ERA API 状态已提交，但一个或多个后置通知失败。');
  }
}

type ApiHandler = (
  detail: unknown,
  context: ApiHandlerContext,
) => void | number | PostCommitNotification | Promise<void | number | PostCommitNotification>;

function objectDetail(detail: unknown): Record<string, any> {
  if (typeof detail !== 'object' || detail === null) {
    throw new TypeError('ERA API 事件需要对象形式的 detail。');
  }
  return detail as Record<string, any>;
}

/**
 * API 事件到处理器的唯一映射表。
 *
 * 所有处理器统一返回 Promise 或后置通知，dispatcher 因而无需知道某个 API 内部是否异步，
 * 也不会再出现“调用了 async 函数却立刻把 Ticket 标记完成”的情况。
 */
const API_HANDLERS: ReadonlyMap<string, ApiHandler> = new Map<string, ApiHandler>([
  [ERA_API_EVENTS.INSERT_BY_OBJECT, detail => insertByObject(objectDetail(detail))],
  [ERA_API_EVENTS.UPDATE_BY_OBJECT, detail => updateByObject(objectDetail(detail))],
  [
    ERA_API_EVENTS.INSERT_BY_PATH,
    detail => {
      const data = objectDetail(detail);
      return insertByPath(data.path, data.value);
    },
  ],
  [
    ERA_API_EVENTS.UPDATE_BY_PATH,
    detail => {
      const data = objectDetail(detail);
      return updateByPath(data.path, data.value);
    },
  ],
  [ERA_API_EVENTS.DELETE_BY_OBJECT, detail => deleteByObject(objectDetail(detail))],
  [ERA_API_EVENTS.DELETE_BY_PATH, detail => deleteByPath(objectDetail(detail).path)],
  [ERA_API_EVENTS.GET_CURRENT_VARS, detail => handleGetCurrentVars(detail)],
  [ERA_API_EVENTS.GET_SNAPSHOT_AT_MK, detail => handleGetSnapshotAtMk(detail)],
  [ERA_API_EVENTS.GET_SNAPSHOTS_BETWEEN_MKS, detail => handleGetSnapshotsBetweenMks(detail)],
  [ERA_API_EVENTS.GET_SNAPSHOT_AT_MID, detail => handleGetSnapshotAtMId(detail)],
  [ERA_API_EVENTS.GET_SNAPSHOTS_BETWEEN_MIDS, detail => handleGetSnapshotsBetweenMIds(detail)],
  [ERA_API_EVENTS.REQUEST_WRITE_DONE, () => handleRequestWriteDone()],
  [ERA_API_EVENTS.FORCE_SYNC, (detail, context) => handleForceSync(detail, context.actionsTaken, context.payload)],
]);

export async function handleApiEvent(
  task: ApiTask,
  actionsTaken: ActionsTaken,
  payload: DispatcherPayload,
): Promise<TaskExecutionResult | void> {
  actionsTaken.api = true;
  const handler = API_HANDLERS.get(task.eventType);
  if (!handler) {
    throw new Error(`没有为 ERA API 事件 ${task.eventType} 注册处理器。`);
  }

  const result = await handler(task.args[0], { actionsTaken, payload });

  if (task.intent === 'message-write') {
    if (typeof result !== 'number' || !Number.isInteger(result) || result < 0) {
      throw new Error(`API 写入 ${task.eventType} 未返回有效的目标消息 ID，无法提交 ERA 状态。`);
    }

    // “追加变量指令”和“将指令提交到 ERA 状态”属于同一个领域事务。
    // 不能再依赖 50ms 后才入队的 era:apiWrite，否则紧随其后的生成栅栏会漏等该同步。
    const notifyStateCommitted = await handleSyncEvent(
      {
        reason: 'api-write',
        target: { kind: 'message', messageId: result, stopAfterTarget: false },
        fullRebuild: false,
      },
      actionsTaken,
      payload,
    );
    return {
      afterCommit: async () => {
        // 兼容广播仍保持在 writeDone 之前，但它已经降级为锁外通知，不再反向驱动状态事务。
        // “之前”指开始广播的调用顺序，不等待其监听器结束；否则等待 writeDone 的旧监听器会造成死锁。
        await runPostCommitNotificationsInOrder([emitApiWriteEvent, notifyStateCommitted]);
      },
    };
  }

  return typeof result === 'function' ? { afterCommit: result } : undefined;
}
