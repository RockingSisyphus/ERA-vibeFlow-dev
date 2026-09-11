/**
 * @file ERA 消息内函数调用的位置绑定执行器
 * @description 在调用位置执行作者函数，并把函数内的 `ERA.commit` 直接交给当前
 * 执行器应用；**绝不入队**。领域顺序与最终提交仍由 Service 决定。
 *
 * 为什么必须绕开队列：函数执行发生在「处理该消息的那一个 FIFO 事件」之内。
 * 若 `ERA.commit` 再入队，它要等当前批次发布后才可能被处理，而当前批次正等着
 * 函数返回——双方互等，工作流永不前进。因此位置绑定的提交走「直接交付当前
 * 计算」这条通道，而不是 Host 的入队口。
 */

import { classifyToolResult, type EraFunctionCallOutcome, type EraToolInvoker } from './era-function-invocation-host';

export type { EraToolInvoker };

/** 把一条已提交的操作应用到当前执行位置的状态；返回本次应用的顺序号。 */
export type EraPositionBoundApply = (
  operation: Readonly<Record<string, unknown>>,
) => Readonly<{ readonly sequence: number }>;

/**
 * 一次位置绑定提交的回执。
 *
 * `applied` 表示操作已经应用到当前执行位置，作者下一次读取即可见；`rejected`
 * 表示提交被拒绝（不在调用中或已取消）。必须区分这两种终态，否则调用方会把
 * 被拒绝的写入当成已生效。
 */
export interface EraPositionBoundReceipt {
  readonly status: 'applied' | 'rejected';
  /** 应用成功时的顺序号，供作者判断提交次序。 */
  readonly sequence: number | null;
  readonly message: string;
}

/**
 * 位置绑定执行器的依赖。
 *
 * `apply` 必须由当前执行器提供，它在函数运行期间就地应用操作；不能替换为入队，
 * 否则处理该消息的 FIFO 事件会与等待函数返回的自身互等。
 */
export interface EraPositionBoundOptions {
  readonly invoker: EraToolInvoker;
  readonly apply: EraPositionBoundApply;
  /**
   * 位置绑定写入的观察通道：Host 适配层用它记录「这条操作来自函数内提交」，
   * 与经 FIFO 的普通 commit 区分开。**不是入队口**——位置绑定写入绝不入队，
   * 否则当前 FIFO 事件会与自己互等。生产不注入时即为无观察者。
   */
  readonly observe?: (operation: Readonly<Record<string, unknown>>) => void;
}

type BoundState = 'idle' | 'running' | 'cancelled' | 'finished';

/**
 * 一次位置绑定调用的执行器。
 *
 * 同一时刻只服务一个调用：`run` 期间接受 `commit`，`run` 结束后或 `cancel`
 * 之后拒绝提交，避免迟到的写入落到已经失效的位置上。
 */
export class EraPositionBoundInvocation {
  private state: BoundState = 'idle';

  constructor(private readonly options: EraPositionBoundOptions) {}

  /**
   * 在当前位置执行作者函数。
   *
   * 失败与取消都返回终态而不是抛异常，调用方据此写错误诊断并继续后续块；
   * 已经成功应用的操作保留，不做回滚。
   */
  async run(name: string, args: Readonly<Record<string, unknown>>): Promise<EraFunctionCallOutcome> {
    if (this.state === 'running') {
      return this.failure(name, 'ERA_POSITION_BOUND_BUSY: 已有调用在执行。');
    }
    this.state = 'running';
    let outcome: EraFunctionCallOutcome;
    try {
      const value = await this.options.invoker.invoke(name, args);
      outcome = classifyToolResult(name, value);
    } catch (error) {
      outcome = this.failure(name, error instanceof Error ? error.message : String(error));
    }
    // cancel 可能在 await 期间被调用，因此按字段重新读取而不是依赖类型收窄。
    const finishedWhileRunning: boolean = this.state === 'running';
    if (!finishedWhileRunning) {
      return {
        status: 'cancelled',
        name,
        result: null,
        message: '调用已取消。',
        unregistered: false,
      };
    }
    this.state = 'finished';
    return outcome;
  }

  /**
   * 函数内提交：直接交给当前执行器应用。
   *
   * 必须拒绝「不在调用中」与「已取消」两种情况，否则外置脚本或迟到的回调会
   * 把操作写进错误的位置；调用方据此报类型化诊断而不是静默丢弃。
   */
  async commit(operations: readonly Readonly<Record<string, unknown>>[]): Promise<EraPositionBoundReceipt> {
    if (this.state === 'cancelled') {
      return this.rejected('ERA_POSITION_BOUND_CANCELLED: 调用已取消，提交被拒绝。');
    }
    if (this.state !== 'running') {
      return this.rejected('ERA_POSITION_BOUND_UNAVAILABLE: 当前没有位置绑定调用，不能就地提交。');
    }
    let lastSequence = 0;
    for (const operation of operations) {
      const receipt = this.options.apply(operation);
      lastSequence = receipt.sequence;
      // 观察通道只记录来源，不改变应用路径。
      this.options.observe?.(operation);
    }
    return { status: 'applied', sequence: lastSequence, message: '' };
  }

  /** 供适配层验证「位置绑定写入不入队」的诊断入口；不改变调用状态。 */
  commitFromOutside(operations: readonly Readonly<Record<string, unknown>>[]): Promise<EraPositionBoundReceipt> {
    return this.commit(operations);
  }

  /**
   * 生命周期结束：此后一切提交都被拒绝。
   *
   * 切聊、停止或 iframe 卸载时调用，避免迟到的函数提交写进新聊天。
   */
  cancel(): void {
    this.state = 'cancelled';
  }

  private rejected(message: string): EraPositionBoundReceipt {
    return { status: 'rejected', sequence: null, message };
  }

  private failure(name: string, message: string): EraFunctionCallOutcome {
    return {
      status: 'failed',
      name,
      result: null,
      message,
      unregistered: false,
    };
  }
}
