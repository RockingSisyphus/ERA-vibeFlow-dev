/**
 * @file ERA 消息内函数调用的宿主机能力操作
 * @description 把 Service 声明的 `era.tavern.functions` 三个操作
 * （invoke / result / release）实现为机械适配：登记调用、在调用位置执行工具、
 * 回送终态与已应用操作数，并在函数运行期间把 `ERA.commit` 接到当前执行位置上。
 *
 * 为什么 position 与 observe 必须分开：position 是函数内提交的**应用**路径，绝不入队
 * ——否则处理该消息的 FIFO 事件会与等待函数返回的自身互等；observe 只记录「这条操作
 * 来自函数内提交」，注入与否都不改变业务结果。
 */

import type { EraFunctionCallOutcome, EraToolInvoker } from './era-function-invocation-host';
import { EraPositionBoundInvocation, type EraPositionBoundReceipt } from './era-position-bound-invocation';

/**
 * 一次函数调用的登记参数。
 *
 * `invocationId` 必须由 Service 生成并稳定：同一函数在一条消息里可被调用多次，
 * 用工具名做键会让同名同参的两处调用互相覆盖。
 */
export interface EraFunctionInvokeInput {
  readonly invocationId: string;
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
}

export interface EraFunctionInvokeAccepted {
  readonly status: 'accepted';
  readonly invocationId: string;
}

export interface EraFunctionResultOutcome extends EraFunctionCallOutcome {
  /** 本次调用成功应用到当前位置的操作条数。 */
  readonly appliedCount: number;
}

export type EraOperationObserver = (operation: Readonly<Record<string, unknown>>) => void;

export type EraPositionApply = (
  operation: Readonly<Record<string, unknown>>,
) => Readonly<{ readonly sequence: number }>;

interface Session {
  readonly invocationId: string;
  readonly name: string;
  /** 位置绑定执行器；必须在会话登记之后创建，否则函数内的首次提交查不到会话。 */
  runner: EraPositionBoundInvocation;
  appliedCount: number;
  outcome: EraFunctionCallOutcome | null;
  waiters: ((outcome: EraFunctionCallOutcome) => void)[];
}

const UNKNOWN_INVOCATION = 'ERA_FUNCTION_INVOCATION_UNKNOWN';

/**
 * 一次函数调用的位置绑定会话表。
 *
 * 每个调用各自持有执行器与已应用操作计数：计数用于 `result` 回执，执行器用于拒绝
 * 越界或已取消的提交；两者分开保存会让取消后的统计与实际应用不一致。
 */
export class EraFunctionOperationsHost {
  /** 与 capability descriptor 声明的 operation 集合保持一致。 */
  static readonly operationNames = ['invoke', 'result', 'release'] as const;

  private readonly sessions = new Map<string, Session>();
  private stopped = false;

  constructor(
    private readonly invoker: EraToolInvoker,
    private readonly applyPosition: EraPositionApply,
    private readonly observe?: EraOperationObserver,
  ) {}

  /**
   * 登记一次待调用并立即返回 accepted。
   *
   * 不能在这里等待函数完成：函数由 Host 在块边界之外驱动，在这里等待会把当前
   * FIFO 事件钉死，Service 也无法继续处理后续块。
   */
  async invoke(input: EraFunctionInvokeInput): Promise<EraFunctionInvokeAccepted> {
    if (this.stopped) return { status: 'accepted', invocationId: input.invocationId };
    const session: Session = {
      invocationId: input.invocationId,
      name: input.name,
      runner: undefined as unknown as EraPositionBoundInvocation,
      appliedCount: 0,
      outcome: null,
      waiters: [],
    };
    this.sessions.set(input.invocationId, session);
    // 先登记再建执行器：函数内首次提交需要能查到这个会话。
    session.runner = this.createRunner(input.invocationId, input.args);
    return { status: 'accepted', invocationId: input.invocationId };
  }

  /**
   * 在调用位置执行函数。
   *
   * 由 Host 在调用位置之外驱动；函数期间的 `commit` 经位置通道就地应用。
   * 同一个调用重复驱动是幂等的：终态只结算一次。
   */
  async run(invocationId: string): Promise<EraFunctionCallOutcome | null> {
    const session = this.sessions.get(invocationId);
    if (session === undefined) return null;
    if (session.outcome !== null) return session.outcome;
    const outcome = await session.runner.run(session.name, {});
    this.settle(session, outcome);
    return outcome;
  }

  /**
   * 函数内提交入口。
   *
   * 必须按调用标识取执行器：位置绑定写入只在函数运行期间有效，越界或已取消的
   * 提交要返回类型化拒绝，否则迟到的回调会把操作写进已经失效的位置。
   */
  async commit(
    invocationId: string,
    operations: readonly Readonly<Record<string, unknown>>[],
  ): Promise<EraPositionBoundReceipt> {
    const session = this.sessions.get(invocationId);
    if (session === undefined) {
      return {
        status: 'rejected',
        sequence: null,
        message: `${UNKNOWN_INVOCATION}: 没有该调用会话，不能就地提交。`,
      };
    }
    return session.runner.commit(operations);
  }

  /** 回送一次调用的终态与已应用操作数；未登记标识返回类型化失败。 */
  async result(input: { readonly invocationId: string }): Promise<EraFunctionResultOutcome> {
    const session = this.sessions.get(input.invocationId);
    if (session === undefined) {
      return {
        status: 'failed',
        name: '',
        result: null,
        message: `${UNKNOWN_INVOCATION}: 没有该调用会话。`,
        unregistered: false,
        appliedCount: 0,
      };
    }
    const outcome = session.outcome ?? (await this.waitFor(session));
    return { ...outcome, appliedCount: session.appliedCount };
  }

  /** 结束一次会话并释放位置绑定状态。 */
  release(input: { readonly invocationId: string }): void {
    this.sessions.delete(input.invocationId);
  }

  /**
   * 生命周期结束：在途调用以取消终态收口，此后一切提交被拒绝。
   *
   * 切聊、停止或 iframe 卸载时必须调用，否则迟到的函数提交会写进新聊天；
   * 这里先给等待方结算取消终态，再清空会话表，避免调用方悬挂。
   */
  stop(): void {
    this.stopped = true;
    for (const session of this.sessions.values()) {
      session.runner.cancel();
      this.settle(session, {
        status: 'cancelled',
        name: session.name,
        result: null,
        message: '调用已取消。',
        unregistered: false,
      });
    }
    this.sessions.clear();
  }

  /**
   * 为一次调用构建位置绑定执行器。
   *
   * 必须在会话登记之后调用：函数内的首次提交要通过调用标识查到自己的会话，
   * 先建执行器会让第一次提交被当成未知会话而拒绝。apply 回调同时累加计数，
   * 供 result 回执报告本次调用实际应用了多少操作。
   */
  private createRunner(invocationId: string, args: Readonly<Record<string, unknown>>): EraPositionBoundInvocation {
    return new EraPositionBoundInvocation({
      invoker: {
        invoke: toolName => this.invoker.invoke(toolName, args),
      },
      // observe 只在执行器内触发一次，这里不能重复调用，否则同一条操作会被观察两次。
      apply: operation => {
        const session = this.sessions.get(invocationId);
        if (session !== undefined) session.appliedCount += 1;
        return this.applyPosition(operation);
      },
      ...(this.observe === undefined ? {} : { observe: this.observe }),
    });
  }

  private settle(session: Session, outcome: EraFunctionCallOutcome): void {
    if (session.outcome !== null) return;
    session.outcome = outcome;
    for (const resolve of session.waiters) resolve(outcome);
    session.waiters = [];
  }

  private waitFor(session: Session): Promise<EraFunctionCallOutcome> {
    if (session.outcome !== null) return Promise.resolve(session.outcome);
    return new Promise<EraFunctionCallOutcome>(resolve => {
      session.waiters.push(resolve);
    });
  }
}
