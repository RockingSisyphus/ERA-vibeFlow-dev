import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INPUT_EVENT } from '../../src/ERA变量框架/events/catalog';
import { EventScheduler, type EventSchedulerOptions } from '../../src/ERA变量框架/events/scheduler';
import type { DomainTask, EventExecutor, EventOutcome } from '../../src/ERA变量框架/events/types';
import { ERA_API_EVENTS } from '../../src/ERA变量框架/utils/constants';
import { parseEraMacroText } from '../../src/ERA变量框架/macro/syntax';

interface Deferred {
  promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function observeSettlement(promise: Promise<unknown>): Promise<() => boolean> {
  let settled = false;
  void promise.then(() => {
    settled = true;
  });
  await Promise.resolve();
  return () => settled;
}

describe('EventScheduler', () => {
  const schedulers: EventScheduler[] = [];

  function createScheduler(
    executor: EventExecutor,
    options: Omit<Partial<EventSchedulerOptions>, 'executor'> = {},
  ): EventScheduler {
    const scheduler = new EventScheduler({ executor, ...options });
    schedulers.push(scheduler);
    return scheduler;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    for (const scheduler of schedulers) {
      scheduler.dispose('单元测试结束');
    }
    schedulers.splice(0);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('在真实等待期结束前不处理默认、swipe 与 updated 事件', async () => {
    const executed: DomainTask[] = [];
    const scheduler = createScheduler(task => {
      executed.push(task);
    });

    const normal = scheduler.enqueue(INPUT_EVENT.MESSAGE_RECEIVED, [3, 'assistant']);
    const isNormalSettled = await observeSettlement(normal.done);
    await vi.advanceTimersByTimeAsync(99);
    expect(executed).toHaveLength(0);
    expect(isNormalSettled()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await scheduler.whenIdle();
    expect(executed).toHaveLength(1);
    expect(isNormalSettled()).toBe(true);

    const swipe = scheduler.enqueue(INPUT_EVENT.MESSAGE_SWIPED, [3]);
    const isSwipeSettled = await observeSettlement(swipe.done);
    await vi.advanceTimersByTimeAsync(499);
    expect(executed).toHaveLength(1);
    expect(isSwipeSettled()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await scheduler.whenIdle();
    expect(executed).toHaveLength(2);
    expect(isSwipeSettled()).toBe(true);

    const updated = scheduler.enqueue(INPUT_EVENT.MESSAGE_UPDATED, [3]);
    const isUpdatedSettled = await observeSettlement(updated.done);
    await vi.advanceTimersByTimeAsync(1_499);
    expect(isUpdatedSettled()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await scheduler.whenIdle();
    expect(await updated.done).toMatchObject({ status: 'ignored' });
  });

  it('MESSAGE_SWIPED 入队立即返回，生成事件到达后提前关闭窗口并保留完整参数', async () => {
    const executionGate = deferred();
    const executed: DomainTask[] = [];
    const scheduler = createScheduler(async task => {
      executed.push(task);
      await executionGate.promise;
    });

    const swipe = scheduler.enqueue(INPUT_EVENT.MESSAGE_SWIPED, [12]);
    const isSwipeSettled = await observeSettlement(swipe.done);
    expect(swipe).toMatchObject({ eventId: 'event:1', sequence: 1 });
    expect(isSwipeSettled()).toBe(false);

    await vi.advanceTimersByTimeAsync(400);
    const generationArgs = ['swipe', { automatic: true }, false] as const;
    const generation = scheduler.enqueue(INPUT_EVENT.GENERATION_STARTED, generationArgs);
    await vi.advanceTimersByTimeAsync(0);

    expect(executed).toHaveLength(1);
    expect(executed[0]).toMatchObject({
      kind: 'sync',
      reason: 'swipe-regeneration',
    });
    expect(executed[0].sourceEvents[1].args).toEqual(generationArgs);
    expect(isSwipeSettled()).toBe(false);

    executionGate.resolve();
    await scheduler.whenIdle();
    expect(await swipe.done).toMatchObject({ status: 'completed', relation: 'combined' });
    expect(await generation.done).toMatchObject({ status: 'completed', relation: 'combined' });
  });

  it('三个并发事件共享合并任务，但每张 Ticket 都在提交后恰好结算一次', async () => {
    const executionGate = deferred();
    let executionCount = 0;
    const scheduler = createScheduler(async () => {
      executionCount += 1;
      await executionGate.promise;
    });

    const receipts = [
      scheduler.enqueue(INPUT_EVENT.MESSAGE_RECEIVED, [1, 'assistant']),
      scheduler.enqueue(INPUT_EVENT.MESSAGE_DELETED, [1]),
      scheduler.enqueue(INPUT_EVENT.CHAT_CHANGED, ['chat-2']),
    ];
    const settleCounts = [0, 0, 0];
    receipts.forEach((receipt, index) => {
      void receipt.done.then(() => {
        settleCounts[index] += 1;
      });
    });

    await vi.advanceTimersByTimeAsync(100);
    expect(executionCount).toBe(1);
    expect(settleCounts).toEqual([0, 0, 0]);

    executionGate.resolve();
    await scheduler.whenIdle();
    expect(settleCounts).toEqual([1, 1, 1]);
    expect(await Promise.all(receipts.map(receipt => receipt.done))).toMatchObject([
      { status: 'completed', relation: 'coalesced' },
      { status: 'completed', relation: 'coalesced' },
      { status: 'completed', relation: 'primary' },
    ]);
  });

  it('waitThrough 只等待目标序号及以前的事件，不被后来事件拖延', async () => {
    const firstExecutionGate = deferred();
    let executionCount = 0;
    const scheduler = createScheduler(async () => {
      executionCount += 1;
      if (executionCount === 1) {
        await firstExecutionGate.promise;
      }
    });

    const stateChange = scheduler.enqueue(INPUT_EVENT.MESSAGE_RECEIVED, [4, 'assistant']);
    const generation = scheduler.enqueue(INPUT_EVENT.GENERATION_STARTED, ['normal', {}, false]);
    const barrier = scheduler.waitThrough(generation.sequence);
    await vi.advanceTimersByTimeAsync(0);
    expect(executionCount).toBe(1);

    const later = scheduler.enqueue(INPUT_EVENT.MESSAGE_SENT, [5]);
    const isLaterSettled = await observeSettlement(later.done);

    firstExecutionGate.resolve();
    const result = await barrier;

    expect(result.throughSequence).toBe(generation.sequence);
    expect(result.outcomes.map(item => item.sequence)).toEqual([stateChange.sequence, generation.sequence]);
    expect(result.hasFailures).toBe(false);
    expect(isLaterSettled()).toBe(false);

    await vi.advanceTimersByTimeAsync(100);
    await scheduler.whenIdle();
    expect(await later.done).toMatchObject({ status: 'completed' });
  });

  it('没有待处理状态变更的生成栅栏立即以 ignored 结算', async () => {
    let executionCount = 0;
    const scheduler = createScheduler(() => {
      executionCount += 1;
    });

    const generation = scheduler.enqueue(INPUT_EVENT.GENERATION_STARTED, ['normal', {}, false]);
    const result = await scheduler.waitThrough(generation.sequence);

    expect(executionCount).toBe(0);
    expect(result).toMatchObject({
      throughSequence: generation.sequence,
      hasFailures: false,
      outcomes: [{ outcome: { status: 'ignored' } }],
    });
  });

  it('executor 失败会结算当前 Ticket，worker 仍能继续处理后续事件', async () => {
    const expectedError = new Error('第一次同步失败');
    const workerErrors: unknown[] = [];
    let executionCount = 0;
    const scheduler = createScheduler(
      () => {
        executionCount += 1;
        if (executionCount === 1) {
          throw expectedError;
        }
      },
      { onWorkerError: error => workerErrors.push(error) },
    );

    const failed = scheduler.enqueue(INPUT_EVENT.MESSAGE_RECEIVED, [1, 'assistant']);
    await vi.advanceTimersByTimeAsync(100);
    await scheduler.whenIdle();
    expect(await failed.done).toEqual({ status: 'failed', error: expectedError });

    const recovered = scheduler.enqueue(INPUT_EVENT.MESSAGE_DELETED, [1]);
    await vi.advanceTimersByTimeAsync(100);
    await scheduler.whenIdle();
    expect(await recovered.done).toMatchObject({ status: 'completed' });
    expect(executionCount).toBe(2);
    expect(workerErrors).toEqual([expectedError]);
  });

  it('已结算成功 Ticket 不长期滞留，历史失败由下一道生成栅栏报告且只报告一次', async () => {
    const expectedError = new Error('历史同步失败');
    let shouldFail = true;
    const scheduler = createScheduler(() => {
      if (shouldFail) {
        shouldFail = false;
        throw expectedError;
      }
    });

    const failed = scheduler.enqueue(INPUT_EVENT.MESSAGE_RECEIVED, [1, 'assistant']);
    await vi.advanceTimersByTimeAsync(100);
    expect(await failed.done).toEqual({ status: 'failed', error: expectedError });

    const firstGeneration = scheduler.enqueue(INPUT_EVENT.GENERATION_STARTED, ['normal', {}, false]);
    const firstBarrier = await scheduler.waitThrough(firstGeneration.sequence);
    expect(firstBarrier.hasFailures).toBe(true);
    expect(firstBarrier.outcomes).toMatchObject([
      { sequence: failed.sequence, outcome: { status: 'failed', error: expectedError } },
      { sequence: firstGeneration.sequence, outcome: { status: 'ignored' } },
    ]);

    const secondGeneration = scheduler.enqueue(INPUT_EVENT.GENERATION_STARTED, ['normal', {}, false]);
    const secondBarrier = await scheduler.waitThrough(secondGeneration.sequence);
    expect(secondBarrier.hasFailures).toBe(false);
    expect(secondBarrier.outcomes).toMatchObject([
      { sequence: secondGeneration.sequence, outcome: { status: 'ignored' } },
    ]);
  });

  it('dispose 取消 pending 与执行中的 Ticket，迟到的结果不会二次结算', async () => {
    const executionGate = deferred();
    let executionSignal: AbortSignal | undefined;
    const scheduler = createScheduler(async (_task, context) => {
      executionSignal = context.signal;
      await executionGate.promise;
    });

    const running = scheduler.enqueue(INPUT_EVENT.MESSAGE_RECEIVED, [1, 'assistant']);
    let settlementCount = 0;
    void running.done.then(() => {
      settlementCount += 1;
    });
    await vi.advanceTimersByTimeAsync(100);

    const pending = scheduler.enqueue(INPUT_EVENT.MESSAGE_SENT, [2]);
    scheduler.dispose('页面已卸载');

    expect(executionSignal?.aborted).toBe(true);
    expect(await running.done).toEqual({ status: 'cancelled', reason: '页面已卸载' });
    expect(await pending.done).toEqual({ status: 'cancelled', reason: '页面已卸载' });

    executionGate.resolve();
    await scheduler.whenIdle();
    await Promise.resolve();
    expect(settlementCount).toBe(1);

    const afterDispose = scheduler.enqueue(INPUT_EVENT.MESSAGE_RECEIVED, [3, 'assistant']);
    expect(await afterDispose.done).toMatchObject({ status: 'cancelled' });
  });

  it('watchdog 只告警一次且不自动放行生成栅栏', async () => {
    const executionGate = deferred();
    const watchdogCalls: unknown[] = [];
    const scheduler = createScheduler(
      async () => {
        await executionGate.promise;
      },
      { watchdogMs: 5_000, onWatchdog: context => watchdogCalls.push(context) },
    );

    const receipt = scheduler.enqueue(INPUT_EVENT.MESSAGE_RECEIVED, [1, 'assistant']);
    const barrier = scheduler.waitThrough(receipt.sequence);
    const isBarrierSettled = await observeSettlement(barrier);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(watchdogCalls).toHaveLength(0);
    expect(isBarrierSettled()).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(watchdogCalls).toEqual([
      {
        throughSequence: receipt.sequence,
        pendingSequences: [receipt.sequence],
        elapsedMs: 5_000,
      },
    ]);
    expect(isBarrierSettled()).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(watchdogCalls).toHaveLength(1);
    expect(isBarrierSettled()).toBe(false);

    executionGate.resolve();
    expect((await barrier).hasFailures).toBe(false);
  });

  it('提交后通知可以重新入队并等待新 Ticket，不会与状态 worker 死锁', async () => {
    let executionCount = 0;
    let nestedOutcome: EventOutcome<unknown> | undefined;

    const scheduler = createScheduler(() => {
      executionCount += 1;
      if (executionCount !== 1) {
        return;
      }

      return {
        afterCommit: async () => {
          const nested = scheduler.enqueue(ERA_API_EVENTS.GET_CURRENT_VARS, ['由通知触发']);
          nestedOutcome = await nested.done;
        },
      };
    });

    const initial = scheduler.enqueue(ERA_API_EVENTS.GET_CURRENT_VARS, ['初始调用']);
    expect(await initial.done).toMatchObject({ status: 'completed' });
    await scheduler.whenNotificationsIdle();
    await scheduler.whenIdle();

    expect(executionCount).toBe(2);
    expect(nestedOutcome).toMatchObject({ status: 'completed' });
  });

  it('通知等待重入任务的新通知时也不会被全局通知链锁死', async () => {
    const nestedNotification = deferred();
    let executionCount = 0;

    const scheduler = createScheduler(() => {
      executionCount += 1;
      if (executionCount === 1) {
        return {
          afterCommit: async () => {
            scheduler.enqueue(ERA_API_EVENTS.GET_CURRENT_VARS, ['由首个通知触发']);
            await nestedNotification.promise;
          },
        };
      }

      return {
        afterCommit: () => {
          nestedNotification.resolve();
        },
      };
    });

    const initial = scheduler.enqueue(ERA_API_EVENTS.GET_CURRENT_VARS, ['初始调用']);
    expect(await initial.done).toMatchObject({ status: 'completed' });

    await scheduler.whenNotificationsIdle();
    await scheduler.whenIdle();

    expect(executionCount).toBe(2);
  });

  it('核心竞态：生成栅栏释放后，宏读取的是上一楼状态而不是旧 swipe', async () => {
    const rollbackGate = deferred();
    const state = { current: '旧 swipe 的变量' };
    const scheduler = createScheduler(async task => {
      if (task.kind === 'sync' && task.reason === 'swipe-regeneration') {
        await rollbackGate.promise;
        state.current = '上一楼的变量';
      }
    });

    scheduler.enqueue(INPUT_EVENT.MESSAGE_SWIPED, [12]);
    const generation = scheduler.enqueue(INPUT_EVENT.GENERATION_STARTED, ['swipe', {}, false]);
    const barrier = scheduler.waitThrough(generation.sequence);
    const isBarrierSettled = await observeSettlement(barrier);

    expect(
      parseEraMacroText('{{ERA:value}}', {
        statWithMeta: { value: state.current },
        statWithoutMeta: { value: state.current },
      }),
    ).toBe('旧 swipe 的变量');
    expect(isBarrierSettled()).toBe(false);

    rollbackGate.resolve();
    expect((await barrier).hasFailures).toBe(false);
    expect(
      parseEraMacroText('{{ERA:value}}', {
        statWithMeta: { value: state.current },
        statWithoutMeta: { value: state.current },
      }),
    ).toBe('上一楼的变量');
  });
});
