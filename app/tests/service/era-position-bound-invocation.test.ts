import { describe, expect, it } from 'vitest';

import {
  EraPositionBoundInvocation,
  type EraPositionBoundApply,
  type EraToolInvoker,
} from '../../src/ERA变量框架/service/era-position-bound-invocation';

interface Operation {
  readonly insert?: Readonly<Record<string, unknown>>;
  readonly edit?: Readonly<Record<string, unknown>>;
  readonly delete?: Readonly<Record<string, unknown>>;
}

/** 最小可用的位置侧应用器：只把操作按顺序追加到当前累计状态。 */
function applier(): { apply: EraPositionBoundApply; applied: Operation[] } {
  const applied: Operation[] = [];
  return {
    applied,
    apply: (operation: Readonly<Record<string, unknown>>) => {
      applied.push(operation as Operation);
      return { sequence: applied.length };
    },
  };
}

function invokerOf(run: (args: Readonly<Record<string, unknown>>) => Promise<string> | string): EraToolInvoker {
  return { invoke: (_name, args) => Promise.resolve(run(args)) };
}

describe('ERA 消息内函数调用：位置绑定调用', () => {
  it('函数内 commit 直接交给当前执行器，不经过任何队列', async () => {
    const { apply, applied } = applier();
    const observed: unknown[] = [];
    const invocation = new EraPositionBoundInvocation({
      invoker: invokerOf(async () => {
        await invocation.commit([{ edit: { hp: { $expr: 'hp - 30' } } }]);
        await invocation.commit([{ insert: { dead: true } }]);
        return 'done';
      }),
      apply,
      observe: operation => observed.push(operation),
    });

    const outcome = await invocation.run('attack', { damage: 30 });

    expect(outcome.status).toBe('completed');
    expect(applied).toEqual([{ edit: { hp: { $expr: 'hp - 30' } } }, { insert: { dead: true } }]);
    // 两次提交都经由位置通道被观察，且顺序与调用顺序一致。
    expect(observed).toEqual(applied);
    // 位置绑定执行器只暴露 apply/observe 两个出口，没有入队参数。
  });

  it('commit 的返回值是「已应用」回执，函数下一次读取能看到它', async () => {
    const { apply } = applier();
    const seen: unknown[] = [];
    const invocation = new EraPositionBoundInvocation({
      invoker: invokerOf(async () => {
        const receipt = await invocation.commit([{ edit: { hp: 70 } }]);
        seen.push(receipt);
        return 'ok';
      }),
      apply,
    });

    await invocation.run('attack', {});

    expect(seen[0]).toMatchObject({ status: 'applied', sequence: 1 });
  });

  it('函数抛错时保留已成功提交的操作，并以失败终态收口', async () => {
    const { apply, applied } = applier();
    const invocation = new EraPositionBoundInvocation({
      invoker: invokerOf(async () => {
        await invocation.commit([{ edit: { hp: 70 } }]);
        throw new Error('boom');
      }),
      apply,
    });

    const outcome = await invocation.run('attack', {});

    expect(outcome.status).toBe('failed');
    expect(outcome.message).toBe('boom');
    expect(applied).toEqual([{ edit: { hp: 70 } }]);
  });

  it('位置绑定上下文之外提交时以类型化诊断拒绝，不静默降级', async () => {
    const { apply, applied } = applier();
    const invocation = new EraPositionBoundInvocation({
      invoker: invokerOf(() => 'never'),
      apply,
    });

    const receipt = await invocation.commitFromOutside([{ insert: { x: 1 } }]);

    expect(receipt).toMatchObject({ status: 'rejected' });
    expect(String(receipt.message)).toContain('ERA_POSITION_BOUND_UNAVAILABLE');
    expect(applied).toEqual([]);
  });

  it('cancel 后不再接受提交，迟到的 commit 被拒绝', async () => {
    const { apply, applied } = applier();
    let release: ((value: string) => void) | null = null;
    const state: { release: ((value: string) => void) | null } = { release: null };
    const invocation = new EraPositionBoundInvocation({
      invoker: {
        invoke: () =>
          new Promise<string>(resolve => {
            state.release = resolve;
            release = resolve;
          }),
      },
      apply,
    });

    const running = invocation.run('slow', {});
    invocation.cancel();
    const receipt = await invocation.commit([{ insert: { late: true } }]);
    state.release?.('late');
    await running;

    expect(receipt).toMatchObject({ status: 'rejected' });
    expect(String(receipt.message)).toContain('ERA_POSITION_BOUND_CANCELLED');
    expect(applied).toEqual([]);
    expect(release).not.toBeNull();
  });

  it('apply 抛错时把失败交给函数，函数可自行捕获后继续', async () => {
    const outcome = await (async () => {
      const invocation = new EraPositionBoundInvocation({
        invoker: invokerOf(async () => {
          try {
            await invocation.commit([{ edit: { hp: 1 } }]);
          } catch {
            return 'caught';
          }
          return 'not-caught';
        }),
        apply: () => {
          throw new Error('apply failed');
        },
      });
      return invocation.run('attack', {});
    })();

    expect(outcome.status).toBe('completed');
    expect(outcome.result).toBe('caught');
  });
});
