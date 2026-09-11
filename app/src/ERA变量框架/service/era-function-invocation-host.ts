/**
 * @file ERA 消息内函数调用的宿主会话
 * @description 模块职责：只负责调用酒馆已注册工具，并把「成功 / 失败 / 未注册 / 取消」
 * 机械地分类成 Host 侧终态。
 *
 * 模块边界：本模块不决定业务顺序、不写入 ERA 业务状态、不保存块进度，也不得让异常
 * 泄漏给调用方；块顺序与最终提交由 Service 决定，工具注册表由宿主适配层注入。
 *
 * 关键事实：SillyTavern 的 `ToolManager.invokeFunctionTool` 在失败时**不抛异常**，
 * 而是返回一个 `Error` 对象（并设置 `error.cause = 工具名`）。而且注册表在顶层窗口、
 * ERA 在脚本 iframe 内，这个 Error 是**跨 realm** 的对象，`instanceof Error` 判不出来。
 * 因此调用结果必须显式且跨 realm 地分类，否则失败会被当成成功结果静默吞掉。
 */

/** 酒馆工具调用器的机械接口；由 Host 适配层注入真实实现。 */
export interface EraToolInvoker {
  invoke(name: string, args: Readonly<Record<string, unknown>>): Promise<unknown>;
}

export type EraFunctionCallStatus = 'completed' | 'failed' | 'cancelled';

/**
 * 一次工具调用的机械结果。
 *
 * 必须显式携带失败原因与是否未注册，否则失败的调用会被下游当成成功结果；
 * 为了保留作者可诊断的错误文本，`message` 原样透传酒馆返回的说明。
 */
export interface EraFunctionCallOutcome {
  /** 终态：完成、失败或取消；取消表示生命周期已结束，迟到结果不再改写会话。 */
  readonly status: EraFunctionCallStatus;
  readonly name: string;
  /** 成功时的可序列化结果文本；失败与取消时为 null。 */
  readonly result: string | null;
  /** 失败或取消的原因说明；成功时为空串。 */
  readonly message: string;
  /** 失败原因是「没有注册同名工具」；据此决定是否提示作者去注册。 */
  readonly unregistered: boolean;
}

const UNREGISTERED_PATTERN = /has not been registered|No tool with the name/i;
const UNKNOWN_INVOCATION = 'ERA_FUNCTION_INVOCATION_UNKNOWN';

function messageOf(error: unknown): string {
  if (isErrorValue(error)) return error.message;
  return error instanceof Error ? error.message : String(error);
}

/**
 * 判定「酒馆返回的是一个错误对象」。
 *
 * 为什么不能只用 `instanceof Error`：ERA 运行在酒馆助手的脚本 iframe 内，而工具注册表
 * 位于**顶层页面**，`ToolManager.invokeFunctionTool` 返回的 Error 由顶层 realm 构造，
 * iframe 里 `value instanceof Error` 为 **false**。实测后果：未注册/失败的调用被当成
 * 成功结果，调用块只写 `status="done"` 而不写 `error="ERA_FCALL_FAILED"`，作者看到
 * 「函数静默无效」。
 *
 * 因此判定必须跨 realm：先看 `Object.prototype.toString` 的 Error 标签（跨 realm 稳定，
 * Error.prototype 带 @@toStringTag），再用 name/message/stack 三件套兜底。
 */
function isErrorValue(value: unknown): value is Error {
  if (value instanceof Error) return true;
  if (value === null || typeof value !== 'object') return false;
  if (Object.prototype.toString.call(value) === '[object Error]') return true;
  const candidate = value as { name?: unknown; message?: unknown; stack?: unknown };
  return (
    typeof candidate.name === 'string' && typeof candidate.message === 'string' && typeof candidate.stack === 'string'
  );
}

/**
 * 把酒馆工具调用结果分类。
 *
 * `Error` 返回值表示工具未注册或执行失败；字符串与非字符串都按可序列化文本
 * 交给调用方，不做业务解释。
 */
export function classifyToolResult(name: string, value: unknown): EraFunctionCallOutcome {
  if (isErrorValue(value)) {
    const message = messageOf(value);
    return {
      status: 'failed',
      name,
      result: null,
      message,
      unregistered: UNREGISTERED_PATTERN.test(message),
    };
  }
  return {
    status: 'completed',
    name,
    result: typeof value === 'string' ? value : JSON.stringify(value ?? null),
    message: '',
    unregistered: false,
  };
}

/**
 * 把**抛出**的异常分类为失败终态。
 *
 * 抛出的值一律是失败——不能走 `classifyToolResult`，否则 `throw "text"` 会被当成
 * 工具成功返回的文本。跨 realm 的 Error 仍交给同一个跨 realm 判定，这样
 * 「未注册」诊断不会因为异常从顶层 realm 抛出而丢失。
 */
export function classifyToolFailure(name: string, error: unknown): EraFunctionCallOutcome {
  if (isErrorValue(error)) return classifyToolResult(name, error);
  return {
    status: 'failed',
    name,
    result: null,
    message: String(error),
    unregistered: false,
  };
}

interface EraInvocationRecord {
  readonly invocationId: string;
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly deferred: Promise<EraFunctionCallOutcome>;
  resolve: ((outcome: EraFunctionCallOutcome) => void) | null;
  settled: EraFunctionCallOutcome | null;
}

/**
 * 有界、随生命周期取消的调用会话表。
 *
 * 会话在 `begin` 时登记标识与待调用，`run` 执行工具并把结果交给等待方，
 * `release` 结束会话。页面停止、切聊或 iframe 卸载时调用 `cancel`，所有在途
 * 调用以取消终态收口，迟到的工具返回值不会改写已取消的会话。
 */
export class EraFunctionInvocationSessions {
  private readonly sessions = new Map<string, EraInvocationRecord>();
  private cancelled = false;

  constructor(private readonly invoker: EraToolInvoker) {}

  /**
   * 登记一次待调用。
   *
   * 必须按调用标识而非工具名登记：同一函数可以在一条消息里被调用多次，
   * 同名同参的两处调用各自独立，用名字做键会互相覆盖。
   */
  begin(input: {
    readonly invocationId: string;
    readonly name: string;
    readonly args: Readonly<Record<string, unknown>>;
  }): void {
    if (this.cancelled) return;
    let resolve: ((outcome: EraFunctionCallOutcome) => void) | null = null;
    const deferred = new Promise<EraFunctionCallOutcome>(done => {
      resolve = done;
    });
    this.sessions.set(input.invocationId, {
      invocationId: input.invocationId,
      name: input.name,
      args: input.args,
      deferred,
      resolve,
      settled: null,
    });
  }

  has(invocationId: string): boolean {
    return this.sessions.has(invocationId);
  }

  hasPendingResult(invocationId: string): boolean {
    const record = this.sessions.get(invocationId);
    return record !== undefined && record.settled === null;
  }

  /** 等待一次调用的终态；未登记的标识返回类型化失败而不抛异常。 */
  result(invocationId: string): Promise<EraFunctionCallOutcome> {
    const record = this.sessions.get(invocationId);
    if (record === undefined) {
      return Promise.resolve({
        status: 'failed',
        name: '',
        result: null,
        message: `${UNKNOWN_INVOCATION}: 没有该调用会话。`,
        unregistered: false,
      });
    }
    return record.deferred;
  }

  /** 执行工具；异常与 Error 返回值都以失败终态收口，不向调用方抛异常。 */
  async run(invocationId: string): Promise<void> {
    const record = this.sessions.get(invocationId);
    if (record === undefined) return;
    if (this.cancelled) {
      this.settle(record, {
        status: 'cancelled',
        name: record.name,
        result: null,
        message: '调用已取消。',
        unregistered: false,
      });
      return;
    }
    let outcome: EraFunctionCallOutcome;
    try {
      const value = await this.invoker.invoke(record.name, record.args);
      outcome = classifyToolResult(record.name, value);
    } catch (error) {
      outcome = classifyToolFailure(record.name, error);
    }
    if (this.cancelled) return;
    this.settle(record, outcome);
  }

  release(invocationId: string): void {
    this.sessions.delete(invocationId);
  }

  /**
   * 生命周期结束：在途调用以取消终态收口。
   *
   * 切聊、停止或 iframe 卸载时必须调用，否则迟到的工具返回值会写进已经失效的
   * 上下文；这里先结算再清空会话表，保证等待方拿到取消终态而不是悬挂。
   */
  cancel(): void {
    this.cancelled = true;
    for (const record of this.sessions.values()) {
      if (record.settled === null) {
        this.settle(record, {
          status: 'cancelled',
          name: record.name,
          result: null,
          message: '调用已取消。',
          unregistered: false,
        });
      }
    }
    this.sessions.clear();
  }

  private settle(record: EraInvocationRecord, outcome: EraFunctionCallOutcome): void {
    if (record.settled !== null) return;
    record.settled = outcome;
    record.resolve?.(outcome);
    record.resolve = null;
  }
}
