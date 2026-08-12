'use strict';

import { ensureMkForLatestMessage } from '../core/key/mk';
import { initializeExternalSettings } from '../initer/auto/settings';
import { ensurePlaceholder } from '../macro/placeholder';
import { logContext, Logger } from '../utils/log';
import { getMessageContentWithRetry, isUserMessage } from '../utils/message';
import { handleApiEvent } from './handlers/api/dispatcher';
import { handleSyncEvent, type SyncExecutionRequest } from './handlers/sync';
import { handleUpdateMkOnlyEvent } from './handlers/updateMkOnly';
import type {
  ActionsTaken,
  DispatcherPayload,
  DomainTask,
  EventExecutionContext,
  SyncTask,
  TaskExecutionResult,
} from './types';

const logger = new Logger();

interface ConsecutiveMkState {
  mk: string | null;
  count: number;
}

let consecutiveMkState: ConsecutiveMkState | null = null;

function updateConsecutiveMkCount(): number {
  const mk = logContext.mk;
  if (mk && consecutiveMkState?.mk === mk) {
    consecutiveMkState.count += 1;
  } else {
    consecutiveMkState = { mk, count: 1 };
  }
  return consecutiveMkState.count;
}

function createActionsTaken(task: DomainTask): ActionsTaken {
  const syncReason = task.kind === 'sync' ? task.reason : null;
  return {
    rollback: false,
    apply: false,
    resync: false,
    api: false,
    apiWrite: syncReason === 'api-write' || (task.kind === 'api' && task.intent === 'message-write'),
    editedResync: syncReason === 'edited',
    swipedRollback: syncReason === 'swipe-regeneration',
  };
}

/**
 * 按领域任务声明准备上下文，而不是再通过事件名维护例外列表。
 *
 * `latest-message` 用于 swipe 重新生成：它只需要定位上一楼，不能在临时 overswipe
 * 消息上注入 MK。其余状态任务声明为 `latest-message-with-mk`，继续沿用 ERA 原有的
 * MK 与占位符保障。
 */
async function prepareDispatcherPayload(task: DomainTask, actions: ActionsTaken): Promise<DispatcherPayload | null> {
  if (task.context === 'none') {
    return {
      mk: '',
      message_id: -1,
      is_user: false,
      actions,
      consecutiveProcessingCount: 1,
    };
  }

  const latestMessage = getChatMessages(-1, { include_swipes: true })?.[0];
  if (!latestMessage) {
    if (task.kind === 'api' && task.intent === 'message-write') {
      throw new Error(`API 写入任务 ${task.id} 找不到可写入的聊天消息。`);
    }
    logger.warn('prepareDispatcherPayload', `任务 ${task.id} 执行时聊天记录为空，按无操作完成。`);
    return null;
  }

  if (task.context === 'latest-message') {
    return {
      mk: '',
      message_id: latestMessage.message_id,
      is_user: isUserMessage(latestMessage),
      actions,
      consecutiveProcessingCount: 1,
    };
  }

  // 读取重试只负责跨过酒馆刚更新消息时的短暂空窗；真正的有效性由 MK 保障函数判断。
  await getMessageContentWithRetry(latestMessage);
  const { mk, message_id: messageId } = await ensureMkForLatestMessage(latestMessage);
  if (!mk || messageId === null) {
    throw new Error(`任务 ${task.id} 无法为最新消息取得有效的 MK 或消息 ID。`);
  }

  await ensurePlaceholder(messageId);
  return {
    mk,
    message_id: messageId,
    is_user: isUserMessage(latestMessage),
    actions,
    consecutiveProcessingCount: 1,
  };
}

function syncRequestFromTask(task: SyncTask): SyncExecutionRequest {
  return {
    reason: task.reason,
    target: task.target,
    fullRebuild: task.fullRebuild,
  };
}

/**
 * 执行一个由合并器规划好的领域任务。
 *
 * 异常不会在这里吞掉：scheduler 负责把它转换为所有来源 Ticket 的 `failed` 结果，
 * 并在 `finally` 中恢复 worker。后置通知随返回值交给 scheduler，在状态执行锁之外运行。
 */
export async function dispatchAndExecuteTask(
  task: DomainTask,
  _context?: EventExecutionContext,
): Promise<TaskExecutionResult | void> {
  const actions = createActionsTaken(task);
  const payload = await prepareDispatcherPayload(task, actions);
  if (!payload) {
    return;
  }

  logContext.mk = payload.mk;
  logger.log('dispatchAndExecuteTask', `执行领域任务: ${task.kind} (${task.id})`);

  try {
    switch (task.kind) {
      case 'initialize': {
        await initializeExternalSettings();
        payload.consecutiveProcessingCount = updateConsecutiveMkCount();
        const afterCommit = await handleSyncEvent(
          {
            reason: 'history-changed',
            target: { kind: 'auto' },
            fullRebuild: false,
          },
          actions,
          payload,
        );
        return { afterCommit };
      }

      case 'sync': {
        payload.consecutiveProcessingCount = updateConsecutiveMkCount();
        const afterCommit = await handleSyncEvent(syncRequestFromTask(task), actions, payload);
        return { afterCommit };
      }

      case 'api':
        return handleApiEvent(task, actions, payload);

      case 'update-mk':
        await handleUpdateMkOnlyEvent(payload.mk);
        return;
    }
  } finally {
    logContext.mk = '';
  }
}
