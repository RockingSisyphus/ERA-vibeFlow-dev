import { runInNewContext } from 'node:vm';

import { describe, expect, it, vi } from 'vitest';

import {
  EraFunctionInvocationSessions,
  classifyToolResult,
  type EraToolInvoker,
} from '../../src/ERA变量框架/service/era-function-invocation-host';

function invokerReturning(value: unknown): EraToolInvoker {
  return { invoke: vi.fn(async () => value) };
}

describe('ERA 消息内函数调用：宿主会话与结果分类', () => {
  it('invokeFunctionTool 返回 Error 对象时判为失败并保留工具名', () => {
    const failure = classifyToolResult('attack', new Error('No tool with the name "attack" has been registered.'));

    expect(failure.status).toBe('failed');
    expect(failure.name).toBe('attack');
    expect(failure.unregistered).toBe(true);
    expect(failure.message).toContain('has been registered');
  });

  it('跨 realm 的 Error 仍判为失败：酒馆工具注册表在顶层窗口，Error 不是本 realm 的实例', () => {
    // 实测形态：ERA 运行在酒馆助手的脚本 iframe 内，ToolManager 在顶层页面，
    // 它返回的 Error 由顶层 realm 构造，因此 iframe 里的 `instanceof Error` 为 false。
    const foreign = runInNewContext(
      'new Error("No tool with the name \\"attack\\" has been registered.")',
    );
    expect(foreign instanceof Error).toBe(false);

    const failure = classifyToolResult('attack', foreign);

    expect(failure.status).toBe('failed');
    expect(failure.unregistered).toBe(true);
    expect(failure.message).toContain('has been registered');
    expect(failure.result).toBe(null);
  });

  it('成功返回字符串时判为成功并保留结果', () => {    const ok = classifyToolResult('dice', '5');

    expect(ok.status).toBe('completed');
    expect(ok.result).toBe('5');
    expect(ok.unregistered).toBe(false);
  });

  it('非字符串结果按 JSON 文本处理，不丢失结构', () => {
    const ok = classifyToolResult('dice', '{"total":5}');

    expect(ok.status).toBe('completed');
    expect(ok.result).toBe('{"total":5}');
  });

  it('会话按调用标识登记，并只在调用完成后返回结果', async () => {
    const sessions = new EraFunctionInvocationSessions(invokerReturning('ok'));
    sessions.begin({ invocationId: 'i1', name: 'dice', args: { sides: 6 } });

    expect(sessions.has('i1')).toBe(true);
    const pending = sessions.result('i1');
    expect(sessions.hasPendingResult('i1')).toBe(true);

    await sessions.run('i1');
    const settled = await pending;

    expect(settled.status).toBe('completed');
    expect(settled.result).toBe('ok');
  });

  it('未登记的调用标识返回类型化失败，不抛异常', async () => {
    const sessions = new EraFunctionInvocationSessions(invokerReturning('ok'));
    const missing = await sessions.result('missing');

    expect(missing.status).toBe('failed');
    expect(missing.message).toContain('ERA_FUNCTION_INVOCATION_UNKNOWN');
  });

  it('release 结束会话并清理状态', async () => {
    const sessions = new EraFunctionInvocationSessions(invokerReturning('ok'));
    sessions.begin({ invocationId: 'i1', name: 'dice', args: {} });
    await sessions.run('i1');
    sessions.release('i1');

    expect(sessions.has('i1')).toBe(false);
  });

  it('cancel 让所有在途调用以取消终态收口', async () => {
    const pendingInfo: { release: ((value: unknown) => void) | null } = { release: null };
    const invoker: EraToolInvoker = {
      invoke: () =>
        new Promise(resolve => {
          pendingInfo.release = resolve;
        }),
    };
    const sessions = new EraFunctionInvocationSessions(invoker);
    sessions.begin({ invocationId: 'i1', name: 'slow', args: {} });
    // 先拿到等待句柄再取消：cancel 会清空会话表，之后 result 只能返回未知会话。
    const pending = sessions.result('i1');
    const running = sessions.run('i1');
    sessions.cancel();

    const outcome = await pending;
    expect(outcome.status).toBe('cancelled');
    pendingInfo.release?.('late');
    await running;
  });

  it('函数抛错时以失败终态收口，不把异常泄漏给调用方', async () => {
    const invoker: EraToolInvoker = {
      invoke: async () => {
        throw new Error('boom');
      },
    };
    const sessions = new EraFunctionInvocationSessions(invoker);
    sessions.begin({ invocationId: 'i1', name: 'explode', args: {} });
    await sessions.run('i1');

    const outcome = await sessions.result('i1');
    expect(outcome.status).toBe('failed');
    expect(outcome.message).toBe('boom');
  });
});
