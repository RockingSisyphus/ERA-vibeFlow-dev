'use strict';

import { updateLatestSelectedMk } from '../../core/key/mk';
import { resyncStateOnHistoryChange } from '../../core/sync';
import { forceRenderRecentMessages } from '../../ui/patch';
import { Logger } from '../../utils/log';
import { emitWriteDoneEvent } from '../emitters/events';
import type { ActionsTaken, DispatcherPayload, PostCommitNotification, SyncTask } from '../types';

const logger = new Logger();

export type SyncExecutionRequest = Pick<SyncTask, 'reason' | 'target' | 'fullRebuild'>;

function resolveTarget(
  request: SyncExecutionRequest,
  latestMessageId: number,
): { targetMessageId?: number; stopAtTarget: boolean } {
  if (request.target.kind === 'auto') {
    return { stopAtTarget: false };
  }

  if (request.target.kind === 'message') {
    return {
      targetMessageId: request.target.messageId,
      stopAtTarget: request.target.stopAfterTarget,
    };
  }

  const previousMessageId = latestMessageId - 1;
  if (previousMessageId < 0) {
    logger.warn('resolveTarget', '当前消息已经是第一楼，无法回退至上一楼，将改为普通差异同步。');
    return { stopAtTarget: false };
  }

  return {
    targetMessageId: previousMessageId,
    stopAtTarget: request.target.stopAfterTarget,
  };
}

/**
 * 执行一次已经由规划器确定语义的状态同步。
 *
 * 这里不再判断原始事件名称。规划器负责说明“为什么同步、同步到哪里”，本函数只负责
 * 完成状态提交并返回后置通知。外部 `writeDone` 与界面刷新必须等调度器释放状态执行锁后
 * 再运行，否则监听通知的脚本如果重新调用 ERA，就可能形成重入等待。
 */
export async function handleSyncEvent(
  request: SyncExecutionRequest,
  actionsTaken: ActionsTaken,
  payload: DispatcherPayload,
): Promise<PostCommitNotification> {
  const { targetMessageId, stopAtTarget } = resolveTarget(request, payload.message_id);

  logger.debug('handleSyncEvent', `开始状态同步，原因: ${request.reason}`, {
    fullRebuild: request.fullRebuild,
    targetMessageId,
    stopAtTarget,
  });

  await resyncStateOnHistoryChange(request.fullRebuild, targetMessageId, stopAtTarget);
  actionsTaken.resync = true;
  await updateLatestSelectedMk(payload.mk);

  logger.debug('handleSyncEvent', '状态同步已经提交。', {
    messages: getChatMessages('0-{{lastMessageId}}', { include_swipes: true }),
  });

  return async () => {
    // 两项都属于锁外通知，可并发启动；writeDone 不必被可选的 1 秒强制刷新延迟。
    // allSettled 确保任一项失败都不会留下游离 rejection，再统一交给 scheduler 记录。
    const results = await Promise.allSettled([forceRenderRecentMessages(), emitWriteDoneEvent(payload)]);
    const errors = results.flatMap(result => (result.status === 'rejected' ? [result.reason] : []));
    if (errors.length > 0) {
      throw new AggregateError(errors, 'ERA 状态已提交，但一个或多个后置通知失败。');
    }
  };
}
