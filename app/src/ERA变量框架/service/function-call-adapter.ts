/** 原生工具调用与Promise请求通道。变量规则由Service共用块循环执行，宿主只搬运请求和回执。 */
import { bindFunctionCallContext } from './function-call-context';
import { createFunctionFacade, type EraSubmit } from './public-api';
import { assertCurrentMessageBasis } from './message-write-target';
import type { EraCapabilityContext, EraSettlement } from './types';

interface Request {
  id: number;
  type: string;
  payload: Readonly<Record<string, unknown>>;
  resolve(value: EraSettlement): void;
  reject(error: Error): void;
}
interface Call {
  id: string;
  active: boolean;
  finished: boolean;
  error: { code: string; message: string } | null;
  requests: Request[];
  pending: Map<number, Request>;
  nextId: number;
  wake: (() => void) | null;
  release(): void;
  assertActive(): void;
}

/** 绑定一次原生调用与独立请求队列，避免参数注入及跨调用的全局位置状态。 */
function startCall(
  input: Readonly<Record<string, unknown>>,
  context: EraCapabilityContext,
  release: (id: string) => void,
): Call {
  const id = String(input.id);
  const parameters = structuredClone(input.args ?? {}) as object;
  const call: Call = {
    id,
    active: true,
    finished: false,
    error: null,
    requests: [],
    pending: new Map(),
    nextId: 1,
    wake: null,
    release: () => undefined,
    assertActive: () => {
      if (!call.active || context.signal.aborted) throw new Error('ERA_FUNCTION_CONTEXT_EXPIRED');
      assertCurrentMessageBasis(input.sourceBasis);
    },
  };
  // 此通道只按接收顺序排队，变量应用留在Service的同一个块循环。
  const submit: EraSubmit = (type, payload) => {
    call.assertActive();
    return new Promise((resolve, reject) => {
      const request: Request = { id: call.nextId++, type, payload: structuredClone(payload), resolve, reject };
      call.requests.push(request);
      call.pending.set(request.id, request);
      call.wake?.();
    });
  };
  const unbind = bindFunctionCallContext(parameters, createFunctionFacade(submit, call.assertActive));
  const abort = () => release(id);
  // 解绑和取消监听必须同时完成，避免作者延后使用陈旧API。
  call.release = () => {
    unbind();
    context.signal.removeEventListener('abort', abort);
  };
  context.signal.addEventListener('abort', abort, { once: true });
  // 原生工具异常转成调用诊断，让Service保留此前成功操作并继续后块。
  Promise.resolve().then(async () => {
    try {
      const result: unknown = await SillyTavern.ToolManager.invokeFunctionTool(input.name, parameters);
      // ToolManager位于酒馆父窗口，其Error不属于脚本iframe的Error构造器。
      if (Object.prototype.toString.call(result) === '[object Error]') throw new Error((result as Error).message);
    } catch (error) {
      call.error = {
        code: 'ERA_FUNCTION_CALL_FAILED',
        message: error instanceof Error ? error.message : String(error),
      };
    } finally {
      call.finished = true;
      call.wake?.();
    }
  });
  return call;
}

/** 把作者函数的等待交回Service块循环，避免函数await commit与外部任务FIFO互相等待。 */
export function createFunctionCallAdapter() {
  const calls = new Map<string, Call>();
  function requireCall(id: unknown): Call {
    const call = calls.get(String(id));
    if (!call?.active) throw new Error('ERA_FUNCTION_CONTEXT_EXPIRED');
    return call;
  }
  function release(id: string): void {
    const call = calls.get(id);
    if (!call) return;
    calls.delete(id);
    call.active = false;
    // 已停止的请求明确拒绝，不能把排队当作已应用。
    for (const request of call.pending.values()) request.reject(new Error('ERA_FUNCTION_CONTEXT_EXPIRED'));
    call.pending.clear();
    call.release();
    call.wake?.();
  }
  return {
    /** 启动时必须绑定原始参数和来源版本，调用结束或消息变化后统一拒绝陈旧请求。 */
    begin(input: Readonly<Record<string, unknown>>, context: EraCapabilityContext): unknown {
      const id = String(input.id);
      if (calls.has(id)) throw new Error('ERA_FUNCTION_CONTEXT_EXISTS');
      if (context.signal.aborted) throw context.signal.reason;
      assertCurrentMessageBasis(input.sourceBasis);
      const call = startCall(input, context, release);
      calls.set(id, call);
      return { status: 'started', id };
    },
    async next(input: Readonly<Record<string, unknown>>, _context: EraCapabilityContext): Promise<unknown> {
      const call = requireCall(input.id);
      for (;;) {
        call.assertActive();
        const request = call.requests.shift();
        if (request) return { kind: 'request', id: request.id, type: request.type, payload: request.payload };
        // 作者未await的请求也须全部回执后，这次调用才真正结束。
        if (call.finished && call.pending.size === 0) return { kind: 'done', error: call.error };
        await new Promise<void>(resolve => {
          call.wake = resolve;
        });
        call.wake = null;
      }
    },
    acknowledge(input: Readonly<Record<string, unknown>>, _context: EraCapabilityContext): unknown {
      const call = requireCall(input.id);
      const request = call.pending.get(Number(input.requestId));
      if (!request) throw new Error('ERA_FUNCTION_REQUEST_MISSING');
      call.pending.delete(request.id);
      request.resolve(structuredClone(input.settlement) as EraSettlement);
      return { status: 'acknowledged' };
    },
    release(input: Readonly<Record<string, unknown>>, _context: EraCapabilityContext): unknown {
      release(String(input.id));
      return { status: 'released' };
    },
    invalidateChanged(): void {
      for (const call of calls.values()) {
        try {
          call.assertActive();
        } catch {
          release(call.id);
        }
      }
    },
    stop(): void {
      for (const id of calls.keys()) release(id);
    },
  };
}
