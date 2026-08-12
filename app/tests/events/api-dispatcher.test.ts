import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ERA_API_EVENTS } from '../../src/ERA变量框架/utils/constants';
import type {
  ActionsTaken,
  ApiTask,
  DispatcherPayload,
  PostCommitNotification,
  RawEvent,
} from '../../src/ERA变量框架/events/types';

const apiMocks = vi.hoisted(() => ({
  insertByObject: vi.fn(),
  updateByObject: vi.fn(),
  insertByPath: vi.fn(),
  updateByPath: vi.fn(),
  deleteByObject: vi.fn(),
  deleteByPath: vi.fn(),
  handleGetCurrentVars: vi.fn(),
  handleGetSnapshotAtMk: vi.fn(),
  handleGetSnapshotsBetweenMks: vi.fn(),
  handleGetSnapshotAtMId: vi.fn(),
  handleGetSnapshotsBetweenMIds: vi.fn(),
  handleRequestWriteDone: vi.fn(),
  handleForceSync: vi.fn(),
  handleSyncEvent: vi.fn(),
  emitApiWriteEvent: vi.fn(),
}));

vi.mock('../../src/ERA变量框架/events/handlers/api/handler', () => ({
  insertByObject: apiMocks.insertByObject,
  updateByObject: apiMocks.updateByObject,
  insertByPath: apiMocks.insertByPath,
  updateByPath: apiMocks.updateByPath,
  deleteByObject: apiMocks.deleteByObject,
  deleteByPath: apiMocks.deleteByPath,
  handleGetCurrentVars: apiMocks.handleGetCurrentVars,
  handleGetSnapshotAtMk: apiMocks.handleGetSnapshotAtMk,
  handleGetSnapshotsBetweenMks: apiMocks.handleGetSnapshotsBetweenMks,
  handleGetSnapshotAtMId: apiMocks.handleGetSnapshotAtMId,
  handleGetSnapshotsBetweenMIds: apiMocks.handleGetSnapshotsBetweenMIds,
  handleRequestWriteDone: apiMocks.handleRequestWriteDone,
  handleForceSync: apiMocks.handleForceSync,
}));

vi.mock('../../src/ERA变量框架/events/handlers/sync', () => ({
  handleSyncEvent: apiMocks.handleSyncEvent,
}));

vi.mock('../../src/ERA变量框架/events/emitters/events', () => ({
  emitApiWriteEvent: apiMocks.emitApiWriteEvent,
}));

import { handleApiEvent } from '../../src/ERA变量框架/events/handlers/api/dispatcher';

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createApiTask(): ApiTask {
  const event: RawEvent = {
    id: 'event:1',
    sequence: 1,
    type: ERA_API_EVENTS.UPDATE_BY_OBJECT,
    args: [{ character: { hp: 8 } }],
    occurredAt: 0,
  };
  return {
    id: 'task:api-write',
    kind: 'api',
    intent: 'message-write',
    eventType: event.type,
    args: event.args,
    sourceEvents: [event],
    primaryEvent: event,
    context: 'latest-message-with-mk',
  };
}

function createContext(): { actions: ActionsTaken; payload: DispatcherPayload } {
  const actions: ActionsTaken = {
    rollback: false,
    apply: false,
    resync: false,
    api: false,
    apiWrite: true,
    editedResync: false,
    swipedRollback: false,
  };
  return {
    actions,
    payload: {
      mk: 'era_mk_latest',
      message_id: 8,
      is_user: false,
      actions,
      consecutiveProcessingCount: 1,
    },
  };
}

describe('API dispatcher 的提交边界', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('消息写入后继续等待同一任务内的 ERA 同步，不能提前完成 Ticket', async () => {
    const syncGate = deferred();
    const notificationOrder: string[] = [];
    const notification: PostCommitNotification = vi.fn(async () => {
      notificationOrder.push('writeDone');
    });
    apiMocks.emitApiWriteEvent.mockImplementationOnce(async () => {
      notificationOrder.push('apiWrite');
    });
    apiMocks.updateByObject.mockResolvedValueOnce(7);
    apiMocks.handleSyncEvent.mockImplementationOnce(async () => {
      await syncGate.promise;
      return notification;
    });

    const { actions, payload } = createContext();
    let settled = false;
    const execution = handleApiEvent(createApiTask(), actions, payload).then(result => {
      settled = true;
      return result;
    });

    await Promise.resolve();
    expect(apiMocks.updateByObject).toHaveBeenCalledWith({ character: { hp: 8 } });
    expect(apiMocks.handleSyncEvent).toHaveBeenCalledWith(
      {
        reason: 'api-write',
        target: { kind: 'message', messageId: 7, stopAfterTarget: false },
        fullRebuild: false,
      },
      actions,
      payload,
    );
    expect(settled).toBe(false);

    syncGate.resolve();
    const result = await execution;
    expect(settled).toBe(true);
    const afterCommit = result?.afterCommit;
    expect(afterCommit).toEqual(expect.any(Function));
    if (typeof afterCommit !== 'function') {
      throw new TypeError('API 写入应返回单个后置通知函数。');
    }

    await afterCommit();
    expect(notificationOrder).toEqual(['apiWrite', 'writeDone']);
  });

  it('旧 apiWrite 通知失败时仍发送 writeDone，并在两者之后汇总报告通知错误', async () => {
    const compatibilityError = new Error('compatibility listener failed');
    const notification: PostCommitNotification = vi.fn();
    apiMocks.updateByObject.mockResolvedValueOnce(7);
    apiMocks.handleSyncEvent.mockResolvedValueOnce(notification);
    apiMocks.emitApiWriteEvent.mockRejectedValueOnce(compatibilityError);

    const { actions, payload } = createContext();
    const result = await handleApiEvent(createApiTask(), actions, payload);
    const afterCommit = result?.afterCommit;
    if (typeof afterCommit !== 'function') {
      throw new TypeError('API 写入应返回单个后置通知函数。');
    }

    await expect(afterCommit()).rejects.toEqual(
      expect.objectContaining({
        name: 'AggregateError',
        errors: [compatibilityError],
      }),
    );
    expect(notification).toHaveBeenCalledOnce();
  });

  it('apiWrite 监听器等待 writeDone 时不形成通知间的循环等待', async () => {
    const writeDoneGate = deferred();
    const notification: PostCommitNotification = vi.fn(async () => {
      writeDoneGate.resolve();
    });
    apiMocks.updateByObject.mockResolvedValueOnce(7);
    apiMocks.handleSyncEvent.mockResolvedValueOnce(notification);
    apiMocks.emitApiWriteEvent.mockImplementationOnce(() => writeDoneGate.promise);

    const { actions, payload } = createContext();
    const result = await handleApiEvent(createApiTask(), actions, payload);
    const afterCommit = result?.afterCommit;
    if (typeof afterCommit !== 'function') {
      throw new TypeError('API 写入应返回单个后置通知函数。');
    }

    await expect(afterCommit()).resolves.toBeUndefined();
    expect(apiMocks.emitApiWriteEvent).toHaveBeenCalledOnce();
    expect(notification).toHaveBeenCalledOnce();
  });
});
