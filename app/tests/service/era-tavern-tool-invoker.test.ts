import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createTavernToolInvoker } from '../../src/ERA变量框架/service/era-tavern-tool-invoker';

describe('ERA 消息内函数调用：酒馆工具调用器适配', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('把作者函数参数原样交给 ToolManager.invokeFunctionTool', async () => {
    const invokeFunctionTool = vi.fn(async () => 'result');
    vi.stubGlobal('SillyTavern', { ToolManager: { invokeFunctionTool } });
    const invoker = createTavernToolInvoker();

    const value = await invoker.invoke('attack', { damage: 30 });

    expect(invokeFunctionTool).toHaveBeenCalledWith('attack', { damage: 30 });
    expect(value).toBe('result');
  });

  it('未注册工具的 Error 返回值原样透传，交由上层分类', async () => {
    const failure = new Error('No tool with the name "ghost" has been registered.');
    vi.stubGlobal('SillyTavern', {
      ToolManager: { invokeFunctionTool: vi.fn(async () => failure) },
    });
    const invoker = createTavernToolInvoker();

    // 适配层不得把 Error 当成结果或抛出：分类是上层职责。
    await expect(invoker.invoke('ghost', {})).resolves.toBe(failure);
  });

  it('缺少 ToolManager 时返回类型化错误而不是抛异常', async () => {
    vi.stubGlobal('SillyTavern', {});
    const invoker = createTavernToolInvoker();

    const value = await invoker.invoke('attack', {});

    expect(value).toBeInstanceOf(Error);
    expect((value as Error).message).toContain('ERA_TOOL_MANAGER_UNAVAILABLE');
  });

  it('工具调用器自身抛异常时原样抛出，不吞掉', async () => {
    vi.stubGlobal('SillyTavern', {
      ToolManager: {
        invokeFunctionTool: vi.fn(async () => {
          throw new Error('transport down');
        }),
      },
    });
    const invoker = createTavernToolInvoker();

    await expect(invoker.invoke('attack', {})).rejects.toThrow('transport down');
  });

  it('结果非字符串时保持原值，序列化由上层负责', async () => {
    vi.stubGlobal('SillyTavern', {
      ToolManager: { invokeFunctionTool: vi.fn(async () => 42) },
    });
    const invoker = createTavernToolInvoker();

    await expect(invoker.invoke('dice', {})).resolves.toBe(42);
  });
});
