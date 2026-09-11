import { describe, expect, it, vi } from 'vitest';

import { EraFunctionOperationsHost } from '../../src/ERA变量框架/service/era-function-operations-host';
import type { EraToolInvoker } from '../../src/ERA变量框架/service/era-function-invocation-host';

function invokerOf(run: (args: Readonly<Record<string, unknown>>) => unknown): EraToolInvoker {
  return { invoke: (_name, args) => Promise.resolve(run(args)) };
}

describe('ERA 消息内函数调用：宿主能力操作', () => {
  it('invoke 登记会话并接受待调用，不等待函数完成', async () => {
    const applied: unknown[] = [];
    const host = new EraFunctionOperationsHost(
      invokerOf(() => 'ok'),
      operation => {
        applied.push(operation);
        return { sequence: applied.length };
      },
    );

    const accepted = await host.invoke({ invocationId: 'i1', name: 'dice', args: { n: 1 } });

    expect(accepted).toMatchObject({ status: 'accepted', invocationId: 'i1' });
  });

  it('函数内提交经位置绑定通道就地应用，并进入观察清单', async () => {
    const applied: unknown[] = [];
    const observed: unknown[] = [];
    const host = new EraFunctionOperationsHost(
      invokerOf(async () => {
        await host.commit('i1', [{ edit: { hp: 70 } }]);
        return 'done';
      }),
      operation => {
        applied.push(operation);
        return { sequence: applied.length };
      },
      operation => {
        observed.push(operation);
      },
    );

    await host.invoke({ invocationId: 'i1', name: 'attack', args: {} });
    await host.run('i1');

    expect(applied).toEqual([{ edit: { hp: 70 } }]);
    expect(observed).toEqual([{ edit: { hp: 70 } }]);
  });

  it('result 返回函数终态与已应用操作数', async () => {
    const host = new EraFunctionOperationsHost(
      invokerOf(async () => {
        await host.commit('i1', [{ edit: { hp: 1 } }, { insert: { dead: true } }]);
        return 'finished';
      }),
      () => ({ sequence: 1 }),
    );

    await host.invoke({ invocationId: 'i1', name: 'attack', args: {} });
    await host.run('i1');
    const outcome = await host.result({ invocationId: 'i1' });

    expect(outcome).toMatchObject({
      status: 'completed',
      name: 'attack',
      result: 'finished',
      appliedCount: 2,
    });
  });

  it('未注册工具经 Error 返回值分类为失败并标记未注册', async () => {
    const host = new EraFunctionOperationsHost(
      invokerOf(() => new Error('No tool with the name "ghost" has been registered.')),
      () => ({ sequence: 1 }),
    );

    await host.invoke({ invocationId: 'i1', name: 'ghost', args: {} });
    await host.run('i1');
    const outcome = await host.result({ invocationId: 'i1' });

    expect(outcome).toMatchObject({ status: 'failed', unregistered: true });
  });

  it('release 结束会话并清理位置绑定状态', async () => {
    const host = new EraFunctionOperationsHost(
      invokerOf(() => 'ok'),
      () => ({ sequence: 1 }),
    );
    await host.invoke({ invocationId: 'i1', name: 'dice', args: {} });
    await host.run('i1');
    host.release({ invocationId: 'i1' });

    const outcome = await host.result({ invocationId: 'i1' });
    expect(outcome.status).toBe('failed');
    expect(outcome.message).toContain('ERA_FUNCTION_INVOCATION_UNKNOWN');
  });

  it('stop 后一切调用与提交都被拒绝，不写入失效上下文', async () => {
    const applied: unknown[] = [];
    const host = new EraFunctionOperationsHost(
      invokerOf(() => 'ok'),
      operation => {
        applied.push(operation);
        return { sequence: applied.length };
      },
    );
    await host.invoke({ invocationId: 'i1', name: 'dice', args: {} });
    host.stop();

    const receipt = await host.commit('i1', [{ insert: { late: true } }]);
    expect(receipt).toMatchObject({ status: 'rejected' });
    expect(applied).toEqual([]);
  });

  it('capability 操作名与登记集合一致', () => {
    expect(EraFunctionOperationsHost.operationNames).toEqual(['invoke', 'result', 'release']);
  });

  it('位置应用与来源观察是两条独立通道，函数内提交同时经过两者', async () => {
    const applySpy = vi.fn(() => ({ sequence: 1 }));
    const observeSpy = vi.fn();
    const host = new EraFunctionOperationsHost(
      invokerOf(async () => {
        await host.commit('i1', [{ insert: { x: 1 } }]);
        return 'ok';
      }),
      applySpy,
      observeSpy,
    );

    await host.invoke({ invocationId: 'i1', name: 'dice', args: {} });
    await host.run('i1');

    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(observeSpy).toHaveBeenCalledTimes(1);
  });

  it('调用不在运行中时提交被拒绝，两个通道都不被触发', async () => {
    const applySpy = vi.fn(() => ({ sequence: 1 }));
    const observeSpy = vi.fn();
    const host = new EraFunctionOperationsHost(
      invokerOf(() => 'ok'),
      applySpy,
      observeSpy,
    );

    await host.invoke({ invocationId: 'i1', name: 'dice', args: {} });
    const receipt = await host.commit('i1', [{ insert: { x: 1 } }]);

    expect(receipt).toMatchObject({ status: 'rejected' });
    expect(String(receipt.message)).toContain('ERA_POSITION_BOUND_UNAVAILABLE');
    expect(applySpy).not.toHaveBeenCalled();
    expect(observeSpy).not.toHaveBeenCalled();
  });
});

describe('ERA 消息内函数调用：宿主生命周期与在途调用', () => {
  it('运行中 stop：在途调用以取消终态收口，迟到提交不再应用', async () => {
    const applied: unknown[] = [];
    const state: { release: ((value: unknown) => void) | null } = { release: null };
    const invoker: EraToolInvoker = {
      invoke: () =>
        new Promise(resolve => {
          state.release = resolve;
        }),
    };
    const host = new EraFunctionOperationsHost(invoker, operation => {
      applied.push(operation);
      return { sequence: applied.length };
    });

    await host.invoke({ invocationId: 'i1', name: 'slow', args: {} });
    // 先取得终态句柄再 stop：stop 会清空会话表，之后 result 只能报未知会话。
    const settled = host.result({ invocationId: 'i1' });
    const running = host.run('i1');
    host.stop();

    const outcome = await settled;
    expect(outcome.status).toBe('cancelled');

    // 迟到的工具返回值不得改写已取消的会话，也不得再应用操作。
    state.release?.('late');
    await running;
    const late = await host.commit('i1', [{ insert: { late: true } }]);
    expect(late).toMatchObject({ status: 'rejected' });
    expect(applied).toEqual([]);
  });

  it('stop 后重新 invoke 不会被受理，也不会复活旧会话', async () => {
    const host = new EraFunctionOperationsHost(
      invokerOf(() => 'ok'),
      () => ({ sequence: 1 }),
    );
    host.stop();

    await host.invoke({ invocationId: 'i2', name: 'dice', args: {} });
    const outcome = await host.result({ invocationId: 'i2' });

    expect(outcome.status).toBe('failed');
    expect(outcome.message).toContain('ERA_FUNCTION_INVOCATION_UNKNOWN');
  });
});
