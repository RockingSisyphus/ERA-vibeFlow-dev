'use strict';

import type { ActionsTaken, WriteDonePayload } from '../utils/constants';

export type { ActionsTaken };

/**
 * 事件在进入 ERA 后的不可变快照。
 *
 * `args` 必须保留酒馆发出的完整参数列表。不要把 Promise、回调或执行状态塞进这里：
 * 原始事件会参与合并和测试，而这些运行时对象应只由调度器私有持有。
 */
export interface RawEvent {
  id: string;
  sequence: number;
  type: string;
  args: readonly unknown[];
  occurredAt: number;
}

export type EventRelation = 'primary' | 'combined' | 'coalesced';

/**
 * 每个原始事件最终都必须得到且只能得到一个结果。
 *
 * “被合并”不是“被丢弃”：combo 和同组折叠仍会在真正的领域任务执行完成后，
 * 以 `combined` 或 `coalesced` 关系结算其来源事件。
 */
export type EventOutcome<T = void> =
  | {
      status: 'completed';
      taskId: string;
      relation: EventRelation;
      value?: T;
    }
  | { status: 'ignored'; reason: string }
  | { status: 'failed'; error: unknown }
  | { status: 'cancelled'; reason: string };

/**
 * 调用方持有的单事件回执。它只代表这一个事件的语义任务，
 * 与“整个调度队列是否为空”没有绑定关系。
 */
export interface EventReceipt<T = void> {
  eventId: string;
  sequence: number;
  done: Promise<EventOutcome<T>>;
}

export type TaskContextRequirement = 'none' | 'latest-message' | 'latest-message-with-mk';

export interface TaskBase {
  id: string;
  sourceEvents: readonly RawEvent[];
  primaryEvent: RawEvent;
  context: TaskContextRequirement;
}

export type SyncReason = 'history-changed' | 'edited' | 'swipe-regeneration' | 'manual' | 'api-write';

export type SyncTarget =
  | { kind: 'auto' }
  | { kind: 'message'; messageId: number; stopAfterTarget: boolean }
  | { kind: 'previous-of-latest'; stopAfterTarget: true };

/**
 * 同步处理器接收的是“要完成什么”，而不是“碰巧由哪个事件触发”。
 * 这使 swipe 回退、消息编辑和普通历史同步可以共享同一条清晰的数据流。
 */
export interface SyncTask extends TaskBase {
  kind: 'sync';
  reason: SyncReason;
  target: SyncTarget;
  fullRebuild: boolean;
}

export interface InitializeTask extends TaskBase {
  kind: 'initialize';
}

export interface ApiTask extends TaskBase {
  kind: 'api';
  /**
   * API 的领域影响由规划器一次性声明。
   * dispatcher 只依据该意图决定是否需要在消息变更后提交 ERA 状态。
   */
  intent: 'query' | 'message-write' | 'state-sync';
  eventType: string;
  args: readonly unknown[];
}

export interface UpdateMkTask extends TaskBase {
  kind: 'update-mk';
}

export type DomainTask = InitializeTask | SyncTask | ApiTask | UpdateMkTask;

export interface PlannedSource {
  event: RawEvent;
  relation: EventRelation;
}

export interface ExecuteStep {
  kind: 'execute';
  task: DomainTask;
  sources: readonly PlannedSource[];
}

export interface IgnoreStep {
  kind: 'ignore';
  events: readonly RawEvent[];
  reason: string;
}

/**
 * 合并器只规划，不执行、记日志或操作 Promise。
 * 因而它可以被假时钟单元测试直接验证，也不会与队列生命周期耦合。
 */
export type PlannedStep = ExecuteStep | IgnoreStep;

export type PostCommitNotification = () => void | Promise<void>;

/**
 * 领域执行器可以在状态提交后附带通知任务。
 * 调度器先结算 Ticket，再把通知放进独立的锁外阶段，避免外部监听器重入 ERA 时占住状态执行锁。
 */
export interface TaskExecutionResult<T = void> {
  value?: T;
  afterCommit?: PostCommitNotification | readonly PostCommitNotification[];
}

export interface EventExecutionContext {
  signal: AbortSignal;
}

export type EventExecutor = (
  task: DomainTask,
  context: EventExecutionContext,
) => void | TaskExecutionResult<unknown> | Promise<void | TaskExecutionResult<unknown>>;

export interface WaitThroughOutcome {
  eventId: string;
  sequence: number;
  outcome: EventOutcome<unknown>;
}

export interface WaitThroughResult {
  throughSequence: number;
  outcomes: readonly WaitThroughOutcome[];
  hasFailures: boolean;
}

/**
 * @interface DispatcherPayload
 * @description 在事件分发器（dispatcher）内部流转的载荷类型。
 * 这是 `WriteDonePayload` 的一个子集，仅包含最核心的上下文信息。
 */
export type DispatcherPayload = Omit<
  WriteDonePayload,
  'stat' | 'statWithoutMeta' | 'meta' | 'selectedMks' | 'editLogs'
>;
