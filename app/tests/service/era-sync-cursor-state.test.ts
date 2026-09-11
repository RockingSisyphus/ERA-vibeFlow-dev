import { describe, expect, it } from 'vitest';

import {
  createInitialServiceState,
  mergeTaskResult,
  reduceForProtocolSlice,
} from '../../../javascript_project/service/base_lib/service_protocol';
import { buildSyncCommitRequest } from '../../../javascript_project/service/base_lib/sync_commit_policy';
import {
  buildSyncCommittedResult,
  buildSyncNonCommitResult,
  stateUpdateForPlan,
} from '../../../javascript_project/service/base_lib/sync_result_policy';

describe('ERA 服务状态：块游标槽', () => {
  it('初始状态带 null 的 syncCursor 槽', () => {
    const state = createInitialServiceState() as unknown as {
      readonly syncCursor?: unknown;
    };

    expect(state).toHaveProperty('syncCursor');
    expect(state.syncCursor).toBe(null);
  });

  it('归约普通事件时原样携带既有 syncCursor', () => {
    const initial = createInitialServiceState();
    const cursor = {
      messageId: 7,
      mk: 'mk-7',
      blockIndex: 2,
      stat: { hp: 70 },
      statFunc: {},
      resolvedCallIds: ['c1'],
      done: false,
    };
    const withCursor = { ...initial, syncCursor: cursor };

    const { reduction } = reduceForProtocolSlice(
      withCursor,
      {
        schemaVersion: 1,
        eventId: 'e1',
        sequence: 1,
        type: 'app_ready',
        occurredAt: 1,
        source: 'tavern',
        args: [],
        encodedBytes: 2,
      } as never,
      {},
    );

    expect(reduction.nextState.syncCursor).toEqual(cursor);
  });

  it('游标是可移植 JSON，不含函数或未定义值', () => {
    const cursor = {
      messageId: 3,
      mk: 'mk-3',
      blockIndex: 1,
      stat: { hp: 5 },
      statFunc: { double: { params: ['x'], expr: 'x * 2' } },
      resolvedCallIds: [],
      done: false,
    };

    const cloned = JSON.parse(JSON.stringify(cursor));

    expect(cloned).toEqual(cursor);
  });
});

/**
 * 游标的传递链：工作项 → 提交请求 → 提交结果 → 任务状态更新 → 批次状态。
 *
 * 逐块提交靠这条链把「已提交到哪一块」跨批次带下去；链上任何一段丢掉游标，恢复就会从
 * 楼层起点重算、把已经提交过的块再算一遍。
 */
describe('ERA 块游标：从工作项到批次状态的传递链', () => {
  const CURSOR = {
    messageId: 4,
    mk: 'mk-4',
    blockIndex: 2,
    stat: { hp: 70 },
    statFunc: {},
    resolvedCallIds: ['c1'],
    done: false,
  };

  function step() {
    const message = {
      schemaVersion: 1,
      messageId: 4,
      role: 'assistant',
      activeText: '<EraFCall name="a" id="c1" status="done"/>',
      swipeIndex: 0,
    };
    const source = {
      schemaVersion: 1,
      eventId: 'event-1',
      sequence: 1,
      type: 'era.message.invoke_continue',
      occurredAt: 1_001,
      source: 'era-api',
      args: [],
      encodedBytes: 64,
    };
    return {
      kind: 'execute',
      stepId: 'step:sync:1',
      index: 0,
      taskRoute: 'sync',
      sourceSequences: [1],
      events: [source],
      task: {
        id: 'task:sync:1',
        sourceEvents: [source],
        primaryEvent: source,
        context: 'latest-message-with-mk',
        kind: 'sync',
        reason: 'history-changed',
        target: { kind: 'auto' },
        fullRebuild: false,
      },
      sources: [{ event: source, relation: 'primary' }],
      // 提交请求要求 V3 派发上下文 + 原始宿主依据；这里给出最小合法形状。
      dispatchContext: {
        schemaVersion: 3,
        status: 'ready',
        dispatchClass: 'sync',
        requirement: 'latest-message-with-mk',
        messages: [message],
        processingMessage: message,
        processingMk: 'mk-4',
        messageChanged: false,
        variablesChanged: false,
        failure: null,
        generationCycleIdentity: null,
        floorIdentity: { chatId: 'chat-1', messageId: 4, swipeId: 0, mk: 'mk-4' },
        stagedMessageUpdates: [],
        agentFloorCandidate: null,
        sourceBasis: {
          identity: { characterId: 'char-1', chatId: 'chat-1', groupId: null },
          messages: [message],
        },
      },
    } as never;
  }

  function batchState(syncCursor: unknown) {
    return {
      schemaVersion: 1,
      batchId: 'batch-1',
      throughSequence: 1,
      nextState: {
        schemaVersion: 1,
        collection: [],
        collectionBytes: 0,
        iteration: 1,
        consecutiveProcessingCount: 0,
        consecutiveMk: null,
        timerToken: null,
        scopeWindow: {
          token: null,
          messageId: null,
          messageAdmission: null,
          branchAdmission: null,
        },
        syncCursor,
      },
      sources: [],
      steps: [step()],
      index: 0,
      settlements: [],
      notifications: [],
      diagnostics: [],
      fatal: false,
      coverageError: null,
    } as never;
  }

  it('stateUpdateForPlan：不带是缺键、显式 null 是清空', () => {
    const plan = { nextConsecutiveState: { mk: 'mk-4', count: 2 } } as never;

    expect(stateUpdateForPlan(plan)).toEqual({
      consecutiveMk: 'mk-4',
      consecutiveProcessingCount: 2,
    });
    expect(stateUpdateForPlan(plan, CURSOR)).toEqual({
      consecutiveMk: 'mk-4',
      consecutiveProcessingCount: 2,
      syncCursor: CURSOR,
    });
    expect(stateUpdateForPlan(plan, null)).toEqual({
      consecutiveMk: 'mk-4',
      consecutiveProcessingCount: 2,
      syncCursor: null,
    });
  });

  it('提交结果把请求里的游标投影为任务状态更新', () => {
    const committed = buildSyncCommittedResult({
      ...buildSyncCommitRequest({
        schemaVersion: 1,
        step: step(),
        disposition: 'commit',
        plan: {
          status: 'fast-sync',
          messages: [{ messageId: 4 }],
          messageUpdates: [],
          stat: { hp: 70 },
          statFunc: {},
          meta: {},
          nextConsecutiveState: { mk: 'mk-4', count: 2 },
        },
        payload: { mk: 'mk-4', message_id: 4, is_user: false, actions: {}, consecutiveProcessingCount: 2 },
        failure: null,
        syncCursor: CURSOR,
      } as never),
      status: 'committed',
      confirmedMessageWrites: 0,
      variablesCommitted: true,
      failure: null,
    } as never);

    expect(committed.stateUpdate).toMatchObject({ syncCursor: CURSOR });
  });

  it('不提交的尾链也能发布游标：提交状态不写，但续做点必须回到批次状态', () => {
    const work = {
      schemaVersion: 1,
      step: step(),
      disposition: 'no-op',
      plan: { nextConsecutiveState: { mk: 'mk-4', count: 2 } },
      payload: null,
      failure: null,
      syncCursor: CURSOR,
    } as never;

    const carried = buildSyncNonCommitResult(work);
    expect(carried.status).toBe('no-op');
    expect(carried.stateUpdate).toMatchObject({ syncCursor: CURSOR });

    // 楼层算完：显式 null 表示清空续做点（凭据与游标都不该留在已完成楼层上）。
    const cleared = buildSyncNonCommitResult({ ...(work as object), syncCursor: null } as never);
    expect(cleared.stateUpdate).toMatchObject({ syncCursor: null });

    // 不带游标键时保持既有行为：只有连续处理事实，不碰游标字段。
    // （必须真的删掉键：写成 `undefined` 仍然算「带键」，会清空游标。）
    const { syncCursor: _omitted, ...withoutCursor } = work as Record<string, unknown>;
    const untouched = buildSyncNonCommitResult(withoutCursor as never);
    expect(untouched.stateUpdate).not.toHaveProperty('syncCursor');
  });

  it('不提交的尾链把收尾呈现意图传下去（不写状态也能刷新楼层）', () => {
    const work = {
      schemaVersion: 1,
      step: step(),
      disposition: 'no-op',
      plan: { nextConsecutiveState: { mk: 'mk-4', count: 2 } },
      payload: null,
      failure: null,
      initialPresentation: { chatId: 'chat-1', messageId: 4, swipeId: 0, mk: 'mk-4' },
    } as never;

    const carried = buildSyncNonCommitResult(work) as unknown as {
      readonly initialPresentation?: { readonly messageId: number };
    };
    expect(carried.initialPresentation).toMatchObject({ messageId: 4 });

    // 不带意图时不添加该字段：呈现节点因此不会做任何宿主调用。
    const { initialPresentation: _omitted, ...withoutIntent } = work as Record<string, unknown>;
    expect(buildSyncNonCommitResult(withoutIntent as never)).not.toHaveProperty('initialPresentation');
  });

  it('批次合并：带键则写入（含显式清空），缺键则保留旧游标', () => {
    const carried = mergeTaskResult(batchState(null), {
      status: 'committed',
      settlements: [],
      notifications: [],
      diagnostics: [],
      stateUpdate: { consecutiveMk: 'mk-4', consecutiveProcessingCount: 2, syncCursor: CURSOR },
    } as never);
    expect((carried.state.nextState as { syncCursor: unknown }).syncCursor).toEqual(CURSOR);

    const cleared = mergeTaskResult(batchState(CURSOR), {
      status: 'committed',
      settlements: [],
      notifications: [],
      diagnostics: [],
      stateUpdate: { consecutiveMk: 'mk-4', consecutiveProcessingCount: 2, syncCursor: null },
    } as never);
    expect((cleared.state.nextState as { syncCursor: unknown }).syncCursor).toBe(null);

    const preserved = mergeTaskResult(batchState(CURSOR), {
      status: 'committed',
      settlements: [],
      notifications: [],
      diagnostics: [],
      stateUpdate: { consecutiveMk: 'mk-4', consecutiveProcessingCount: 2 },
    } as never);
    expect((preserved.state.nextState as { syncCursor: unknown }).syncCursor).toEqual(CURSOR);
  });
});
