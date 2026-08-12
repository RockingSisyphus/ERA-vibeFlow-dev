'use strict';

import { getCollectionWindowMs, getEventDefinition, shouldCloseCollectionWindow } from './catalog';
import { hasImmediateCombo, planEventBatch } from './merger';
import type {
  EventExecutor,
  EventOutcome,
  EventReceipt,
  PlannedStep,
  PostCommitNotification,
  RawEvent,
  TaskExecutionResult,
  WaitThroughOutcome,
  WaitThroughResult,
} from './types';

export interface SchedulerClock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface WatchdogContext {
  throughSequence: number;
  pendingSequences: readonly number[];
  elapsedMs: number;
}

export interface EventSchedulerOptions {
  executor: EventExecutor;
  clock?: SchedulerClock;
  planner?: (events: readonly RawEvent[]) => readonly PlannedStep[];
  watchdogMs?: number;
  onWatchdog?: (context: WatchdogContext) => void;
  onWorkerError?: (error: unknown) => void;
  onNotificationError?: (error: unknown) => void;
}

export interface EventSchedulerPort {
  enqueue(type: string, args?: readonly unknown[]): EventReceipt<unknown>;
  waitThrough(sequence: number): Promise<WaitThroughResult>;
}

export interface EventHandlerOptions {
  onBarrierSettled?: (result: WaitThroughResult) => void | Promise<void>;
}

export type EventHandler = (...args: unknown[]) => void | Promise<void>;

interface ReceiptRecord {
  event: RawEvent;
  receipt: EventReceipt<unknown>;
  settled: boolean;
  settle(outcome: EventOutcome<unknown>): void;
}

interface ActiveCollection {
  close(): void;
}

interface DeferredStepCompletion {
  sequences: readonly number[];
  notifications: readonly PostCommitNotification[];
  complete(): void;
}

const DEFAULT_WATCHDOG_MS = 5000;

const SYSTEM_CLOCK: SchedulerClock = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: handle => globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>),
};

function toNotifications(result: void | TaskExecutionResult<unknown>): readonly PostCommitNotification[] {
  if (!result?.afterCommit) {
    return [];
  }
  return typeof result.afterCommit === 'function' ? [result.afterCommit] : result.afterCommit;
}

/**
 * 根据目录声明创建酒馆监听器。该工厂不读取浏览器全局，入口和 Node 测试可共用。
 *
 * 返回值是刻意设计的：detached 事件同步返回 undefined；只有真实生成事件返回 Promise。
 * 因而 MESSAGE_SWIPED 永远不会等一个尚未发生的 GENERATION_STARTED，也不会形成因果死锁。
 */
export function createEventHandler(
  scheduler: EventSchedulerPort,
  eventType: string,
  options: EventHandlerOptions = {},
): EventHandler {
  const definition = getEventDefinition(eventType);

  return (...args: unknown[]) => {
    const receipt = scheduler.enqueue(eventType, args);
    const shouldAwait = definition?.awaitMode === 'generation-barrier' && shouldCloseCollectionWindow(eventType, args);

    if (!shouldAwait) {
      return undefined;
    }

    return scheduler.waitThrough(receipt.sequence).then(async result => {
      await options.onBarrierSettled?.(result);
    });
  };
}

/**
 * ERA 的单 worker 事件调度器。
 *
 * 它只负责事件时序、批次规划与 Ticket 生命周期；聊天读取、变量同步及 UI 通知
 * 都由注入的 executor 完成。这个边界让生产环境与假时钟测试使用同一份调度逻辑。
 */
export class EventScheduler {
  private readonly executor: EventExecutor;
  private readonly clock: SchedulerClock;
  private readonly planner: (events: readonly RawEvent[]) => readonly PlannedStep[];
  private readonly watchdogMs: number;
  private readonly onWatchdog?: (context: WatchdogContext) => void;
  private readonly onWorkerError?: (error: unknown) => void;
  private readonly onNotificationError?: (error: unknown) => void;

  private readonly pendingEvents: RawEvent[] = [];
  /**
   * 回执表只保留尚未结算的 Ticket。成功结果已经提交，无须等到下一次生成才占用内存；
   * 失败则进入独立日志，供下一道生成栅栏报告一次。
   */
  private readonly receiptRecords = new Map<number, ReceiptRecord>();
  private readonly unreportedFailures = new Map<number, WaitThroughOutcome>();
  private readonly idleWaiters = new Set<() => void>();
  private readonly lifecycle = new AbortController();

  private nextSequence = 1;
  private running = false;
  private disposed = false;
  private activeCollection: ActiveCollection | null = null;
  private readonly activeNotificationRuns = new Set<Promise<void>>();

  constructor(options: EventSchedulerOptions) {
    this.executor = options.executor;
    this.clock = options.clock ?? SYSTEM_CLOCK;
    this.planner = options.planner ?? planEventBatch;
    this.watchdogMs = options.watchdogMs ?? DEFAULT_WATCHDOG_MS;
    this.onWatchdog = options.onWatchdog;
    this.onWorkerError = options.onWorkerError;
    this.onNotificationError = options.onNotificationError;
  }

  /**
   * 接收完整事件参数并返回该事件自己的回执。
   * 入队本身永不等待 worker，因此 `MESSAGE_SWIPED` 可以安全地保持 detached。
   */
  enqueue(type: string, args: readonly unknown[] = []): EventReceipt<unknown> {
    const sequence = this.nextSequence++;
    const event: RawEvent = Object.freeze({
      id: `event:${sequence}`,
      sequence,
      type,
      args: Object.freeze([...args]),
      occurredAt: this.clock.now(),
    });
    const record = this.createReceiptRecord(event);

    if (this.disposed) {
      record.settle({ status: 'cancelled', reason: '事件调度器已经卸载' });
      return record.receipt;
    }

    this.pendingEvents.push(event);

    // 生成开始是提示词处理前的天然边界。关闭窗口只表示“现在开始规划”，
    // 并不会让 MESSAGE_SWIPED 自己等待后续尚未发生的 GENERATION_STARTED。
    if (this.activeCollection && (shouldCloseCollectionWindow(type, args) || hasImmediateCombo(this.pendingEvents))) {
      this.activeCollection.close();
    }

    this.startWorker();
    return record.receipt;
  }

  /**
   * 等待目标序号以及更早的、当前仍需结算的事件。
   *
   * 这里刻意不提供 `waitUntilIdle()` 作为生成栅栏：后来进入的 UI/API 事件不应
   * 延迟当前请求，更不能因持续有新事件而让酒馆无限等待。
   */
  async waitThrough(sequence: number): Promise<WaitThroughResult> {
    const previousFailures = [...this.unreportedFailures.values()].filter(item => item.sequence <= sequence);
    const records = [...this.receiptRecords.values()]
      .filter(record => record.event.sequence <= sequence)
      .sort((left, right) => left.event.sequence - right.event.sequence);

    let watchdogHandle: unknown;
    if (records.length > 0 && this.watchdogMs > 0) {
      watchdogHandle = this.clock.setTimeout(() => {
        const pendingSequences = records.filter(record => !record.settled).map(record => record.event.sequence);
        if (pendingSequences.length > 0) {
          this.onWatchdog?.({
            throughSequence: sequence,
            pendingSequences,
            elapsedMs: this.watchdogMs,
          });
        }
      }, this.watchdogMs);
    }

    try {
      const pendingOutcomes: WaitThroughOutcome[] = await Promise.all(
        records.map(async record => ({
          eventId: record.event.id,
          sequence: record.event.sequence,
          outcome: await record.receipt.done,
        })),
      );
      const outcomes = [...previousFailures, ...pendingOutcomes].sort((left, right) => left.sequence - right.sequence);

      return {
        throughSequence: sequence,
        outcomes,
        hasFailures: outcomes.some(item => item.outcome.status === 'failed' || item.outcome.status === 'cancelled'),
      };
    } finally {
      if (watchdogHandle !== undefined) {
        this.clock.clearTimeout(watchdogHandle);
      }

      // 失败只需要在下一道覆盖它的生成栅栏中报告一次。并发 waitThrough 已取得各自
      // 的 Promise/失败快照，不会因为这里删除索引而丢失结果。
      for (const failedSequence of this.unreportedFailures.keys()) {
        if (failedSequence <= sequence) {
          this.unreportedFailures.delete(failedSequence);
        }
      }
    }
  }

  /**
   * 仅供测试和受控关闭流程使用。业务栅栏必须使用 waitThrough(sequence)。
   */
  whenIdle(): Promise<void> {
    if (!this.running && this.pendingEvents.length === 0) {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      this.idleWaiters.add(resolve);
    });
  }

  /** 等待当前以及等待期间新产生的锁外通知全部结束，主要供测试和受控关闭流程使用。 */
  async whenNotificationsIdle(): Promise<void> {
    while (this.activeNotificationRuns.size > 0) {
      await Promise.all([...this.activeNotificationRuns]);
    }
  }

  /**
   * 卸载时立即结算所有 Ticket，并用 AbortSignal 通知当前 executor 尽快停止。
   * settle 是幂等的，因此迟到的执行结果不会覆盖 cancellation。
   */
  dispose(reason = 'ERA 事件调度器已卸载'): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.lifecycle.abort(reason);
    this.pendingEvents.splice(0);
    this.activeCollection?.close();

    for (const record of this.receiptRecords.values()) {
      record.settle({ status: 'cancelled', reason });
    }
    this.unreportedFailures.clear();

    this.resolveIdleWaitersIfNeeded();
  }

  private createReceiptRecord(event: RawEvent): ReceiptRecord {
    let resolveOutcome: (outcome: EventOutcome<unknown>) => void = () => undefined;
    const done = new Promise<EventOutcome<unknown>>(resolve => {
      resolveOutcome = resolve;
    });

    const record: ReceiptRecord = {
      event,
      receipt: {
        eventId: event.id,
        sequence: event.sequence,
        done,
      },
      settled: false,
      settle: outcome => {
        if (record.settled) {
          return;
        }
        record.settled = true;
        if (outcome.status === 'failed' || outcome.status === 'cancelled') {
          this.unreportedFailures.set(event.sequence, {
            eventId: event.id,
            sequence: event.sequence,
            outcome,
          });
        }
        this.receiptRecords.delete(event.sequence);
        resolveOutcome(outcome);
      },
    };

    this.receiptRecords.set(event.sequence, record);
    return record;
  }

  private startWorker(): void {
    if (this.running || this.disposed) {
      return;
    }

    this.running = true;
    void this.runWorker();
  }

  private async runWorker(): Promise<void> {
    const committedNotifications: PostCommitNotification[] = [];
    const completions: DeferredStepCompletion[] = [];
    const coveredSequences = new Set<number>();
    let activeBatch: RawEvent[] = [];

    try {
      if (!this.disposed && this.pendingEvents.length > 0) {
        const batch = await this.collectBatch();
        activeBatch = batch;

        if (batch.length > 0) {
          try {
            const steps = this.planner(batch);
            for (const step of steps) {
              const completion = await this.executeStep(step);
              completions.push(completion);
              completion.sequences.forEach(sequence => coveredSequences.add(sequence));
              committedNotifications.push(...completion.notifications);
            }
          } catch (error) {
            this.reportWorkerError(error);
            for (const event of batch) {
              if (!coveredSequences.has(event.sequence)) {
                completions.push(this.failedCompletion([event], error));
                coveredSequences.add(event.sequence);
              }
            }
          } finally {
            // 自定义 planner 若漏掉来源事件，会在这里显式失败，而不是制造永不结束的栅栏。
            for (const event of batch) {
              if (!coveredSequences.has(event.sequence)) {
                completions.push(
                  this.failedCompletion(
                    [event],
                    new Error(`事件规划结果没有结算来源事件：${event.type}#${event.sequence}`),
                  ),
                );
                coveredSequences.add(event.sequence);
              }
            }
          }
        }
      }
    } catch (error) {
      this.reportWorkerError(error);
      // collectBatch 自身失败时尚未形成 activeBatch，只终止当时等待的那批 pending；
      // 已经结算的历史 Receipt 和之后重新入队的事件不应被这次异常连带污染。
      const affectedEvents =
        activeBatch.length > 0 ? activeBatch : this.pendingEvents.splice(0, this.pendingEvents.length);
      for (const event of affectedEvents) {
        if (!coveredSequences.has(event.sequence)) {
          completions.push(this.failedCompletion([event], error));
          coveredSequences.add(event.sequence);
        }
      }
    } finally {
      this.activeCollection = null;
      this.running = false;

      // 必须先释放状态 worker，才能把外部通知交给独立的并发阶段。通知监听器若再次调用 ERA，
      // 只会产生一个新批次，不会重入尚未结束的状态事务。
      for (const completion of completions) {
        completion.complete();
      }
      if (!this.disposed) {
        this.scheduleNotifications(committedNotifications);
      }

      this.resolveIdleWaitersIfNeeded();

      // 每个 worker 只处理一个批次，使每批通知都能在状态事务之外独立启动。
      if (!this.disposed && this.pendingEvents.length > 0) {
        this.startWorker();
      }
    }
  }

  private async collectBatch(): Promise<RawEvent[]> {
    const first = this.pendingEvents[0];
    if (!first) {
      return [];
    }

    const waitMs = getCollectionWindowMs(first.type);
    const latestEvent = this.pendingEvents.at(-1);
    const alreadyAtBoundary =
      (latestEvent ? shouldCloseCollectionWindow(latestEvent.type, latestEvent.args) : false) ||
      hasImmediateCombo(this.pendingEvents);

    if (waitMs <= 0 || alreadyAtBoundary) {
      return this.drainCollectedBatch();
    }

    await new Promise<void>(resolve => {
      let closed = false;
      let timerHandle: unknown = undefined;

      const close = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (timerHandle !== undefined) {
          this.clock.clearTimeout(timerHandle);
        }
        if (this.activeCollection?.close === close) {
          this.activeCollection = null;
        }
        resolve();
      };

      this.activeCollection = { close };
      timerHandle = this.clock.setTimeout(close, waitMs);

      // dispose 可能发生在设置窗口与设置定时器之间；再次检查可确保卸载不遗留等待。
      if (this.disposed) {
        close();
      }
    });

    return this.drainCollectedBatch();
  }

  /**
   * 生成边界之后到达的事件属于下一批。即使 worker 当时正忙，
   * 它们也不能被倒吸进已经开始等待的生成请求。
   */
  private drainCollectedBatch(): RawEvent[] {
    const boundaryIndex = this.pendingEvents.findIndex(event => shouldCloseCollectionWindow(event.type, event.args));
    const count = boundaryIndex === -1 ? this.pendingEvents.length : boundaryIndex + 1;
    return this.pendingEvents.splice(0, count);
  }

  private async executeStep(step: PlannedStep): Promise<DeferredStepCompletion> {
    if (step.kind === 'ignore') {
      return {
        sequences: step.events.map(event => event.sequence),
        notifications: [],
        complete: () => {
          for (const event of step.events) {
            this.settleEvent(event, { status: 'ignored', reason: step.reason });
          }
        },
      };
    }

    try {
      const result = await this.executor(step.task, { signal: this.lifecycle.signal });
      return {
        sequences: step.sources.map(source => source.event.sequence),
        notifications: this.disposed ? [] : toNotifications(result),
        complete: () => {
          for (const source of step.sources) {
            this.settleEvent(source.event, {
              status: 'completed',
              taskId: step.task.id,
              relation: source.relation,
              value: result?.value,
            });
          }
        },
      };
    } catch (error) {
      this.reportWorkerError(error);
      return this.failedCompletion(
        step.sources.map(source => source.event),
        error,
      );
    }
  }

  private failedCompletion(events: readonly RawEvent[], error: unknown): DeferredStepCompletion {
    return {
      sequences: events.map(event => event.sequence),
      notifications: [],
      complete: () => {
        for (const event of events) {
          this.settleEvent(event, { status: 'failed', error });
        }
      },
    };
  }

  private settleEvent(event: RawEvent, outcome: EventOutcome<unknown>): void {
    this.receiptRecords.get(event.sequence)?.settle(outcome);
  }

  private scheduleNotifications(notifications: readonly PostCommitNotification[]): void {
    if (notifications.length === 0) {
      return;
    }

    const run = (async () => {
      // 保持调用启动顺序，但不等待前一项结束后才启动后一项。通知监听器可能重入 ERA，
      // 并等待重入任务产生的新通知；若把所有通知串成单链，就会形成一把新的“隐形锁”。
      const pending = notifications.map(notify => {
        if (this.disposed) {
          return Promise.resolve();
        }
        try {
          return Promise.resolve(notify());
        } catch (error) {
          return Promise.reject(error);
        }
      });

      const results = await Promise.allSettled(pending);
      for (const result of results) {
        if (result.status === 'rejected') {
          try {
            this.onNotificationError?.(result.reason);
          } catch (reportError) {
            console.error('ERA 后置通知的错误报告回调发生异常。', reportError);
          }
        }
      }
    })();

    this.activeNotificationRuns.add(run);
    void run.then(
      () => this.activeNotificationRuns.delete(run),
      error => {
        // run 内已经隔离通知错误；这里只防御调度代码自身出现意外 rejection。
        this.activeNotificationRuns.delete(run);
        console.error('ERA 后置通知调度发生异常。', error);
      },
    );
  }

  private reportWorkerError(error: unknown): void {
    try {
      this.onWorkerError?.(error);
    } catch (reportError) {
      console.error('ERA 事件调度器的错误报告回调发生异常。', reportError);
    }
  }

  private resolveIdleWaitersIfNeeded(): void {
    if (this.running || this.pendingEvents.length > 0) {
      return;
    }

    for (const resolve of this.idleWaiters) {
      resolve();
    }
    this.idleWaiters.clear();
  }
}
