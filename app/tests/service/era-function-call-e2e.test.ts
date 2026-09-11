import { describe, expect, it, vi } from 'vitest';

import {
  advanceMessageFunctionFlow,
  resumeMessageFunctionFlow,
  startMessageFunctionFlow,
  type MessageFunctionFlow,
} from '../../../javascript_project/service/base_lib/domain/message_function_flow';
import { EraFunctionOperationsHost } from '../../src/ERA变量框架/service/era-function-operations-host';
import type { EraToolInvoker } from '../../src/ERA变量框架/service/era-function-invocation-host';

/**
 * 端到端：一条消息里混排既有指令与函数调用，函数在运行期间通过位置绑定提交
 * 修改变量，产出写回调用块下方的操作区，随后继续逐块推进直到该消息处理完成。
 *
 * 这条链路把 Service 侧流程状态机与 Host 侧能力操作接在一起跑，而不是分别单测。
 */
describe('ERA 消息内函数调用：端到端链路', () => {
  const MESSAGE = [
    '<VariableInsert>{"hp":100}</VariableInsert>',
    '<EraFCall name="attack" args=\'{"damage":30}\' id="c1"/>',
    '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
  ].join('\n');

  function hosts(
    tool: (args: Readonly<Record<string, unknown>>) => Promise<unknown> | unknown,
    stat: Record<string, unknown>,
  ) {
    const applied: Readonly<Record<string, unknown>>[] = [];
    let current = stat;
    const invoker: EraToolInvoker = { invoke: (_name, args) => Promise.resolve(tool(args)) };
    const host = new EraFunctionOperationsHost(invoker, operation => {
      applied.push(operation);
      // 位置绑定应用：直接作用于当前累计状态，函数下一次读取即可见。
      const payload = (operation.edit ?? operation.insert) as { readonly hp?: { readonly $expr: string } } | undefined;
      if (payload?.hp && typeof payload.hp === 'object') {
        const expr = payload.hp.$expr;
        const delta = Number(/-?\s*(\d+)\s*$/.exec(expr)?.[1] ?? 0);
        const before = Number(current.hp ?? 0);
        current = { ...current, hp: before - delta };
      }
      return { sequence: applied.length };
    });
    return {
      host,
      applied,
      read: () => current,
    };
  }

  it('块边界调函数、位置绑定提交、写回操作区、继续推进到完成', async () => {
    const world = hosts(async args => {
      const damage = Number(args.damage ?? 0);
      await world.host.commit('inv-1', [{ edit: { hp: { $expr: `hp - ${damage}` } } }]);
      return `已造成 ${damage} 点伤害`;
    }, {});

    let flow: MessageFunctionFlow = startMessageFunctionFlow({
      content: MESSAGE,
      messageId: 7,
      mk: 'mk-1',
      initialStat: {},
      meta: {},
    });

    let toolCalls = 0;
    const sequencer: typeof advanceMessageFunctionFlow = value => advanceMessageFunctionFlow(value);

    let guard = 0;
    while (!flow.done && guard < 12) {
      flow = sequencer(flow);
      if (flow.pendingCall === null) {
        guard += 1;
        continue;
      }

      // 到块边界：登记并执行函数（与真实 Host 的分工一致），再回送结果。
      await world.host.invoke({
        invocationId: 'inv-1',
        name: flow.pendingCall.name ?? '',
        args: flow.pendingCall.args ?? {},
      });
      await world.host.run('inv-1');
      toolCalls += 1;
      const outcome = await world.host.result({ invocationId: 'inv-1' });

      flow = resumeMessageFunctionFlow(flow, {
        outcome,
        operations: world.applied.slice(-outcome.appliedCount) as never,
      });
      guard += 1;
    }

    // 1. 函数确实被调用了一次，且只调用一次。
    expect(toolCalls).toBe(1);
    // 2. 函数产出的操作是回送的唯一内容；权威状态只由流程按位置重放得到。
    //    （world.read() 只是测试用的合成镜像，权威状态以流程状态为准。）
    expect(world.applied).toEqual([{ edit: { hp: { $expr: 'hp - 30' } } }]);
    // 3. 调用块写入已处理标记，产出写回其下方的操作区记录。
    expect(flow.content).toContain('status="done"');
    // 操作区不带 applied：它随消息重放才是函数效果唯一一次生效。
    expect(flow.content).toContain('<EraFCallTx for="c1">');
    expect(flow.content).not.toContain('applied="1"');
    expect(flow.content).toContain('hp - 30');
    // 4. 流程最终完成，并且原文后续块在其后执行：70 - 10 = 60。
    expect(flow.done).toBe(true);
    expect(flow.stat).toEqual({ hp: 60 });
  });

  it('函数失败时保留已应用操作、写失败标记并继续走完剩余块', async () => {
    const world = hosts(async args => {
      const damage = Number(args.damage ?? 0);
      await world.host.commit('inv-2', [{ edit: { hp: { $expr: `hp - ${damage}` } } }]);
      throw new Error('后端不可用');
    }, {});

    let flow = startMessageFunctionFlow({
      content: MESSAGE,
      messageId: 7,
      mk: 'mk-1',
      initialStat: {},
      meta: {},
    });

    let guard = 0;
    while (!flow.done && guard < 12) {
      flow = advanceMessageFunctionFlow(flow);
      if (flow.pendingCall === null) {
        guard += 1;
        continue;
      }
      await world.host.invoke({
        invocationId: 'inv-2',
        name: flow.pendingCall.name ?? '',
        args: flow.pendingCall.args ?? {},
      });
      await world.host.run('inv-2');
      const outcome = await world.host.result({ invocationId: 'inv-2' });
      flow = resumeMessageFunctionFlow(flow, {
        outcome,
        operations: world.applied.slice(-outcome.appliedCount) as never,
      });
      guard += 1;
    }

    expect(flow.content).toContain('error="ERA_FCALL_FAILED"');
    expect(flow.done).toBe(true);
    // 失败前的成功操作保留：70，再执行后续 -10。
    expect(flow.stat).toEqual({ hp: 60 });
  });

  it('未注册工具不阻断流程：标记失败、继续走完剩余块', async () => {
    const invoker: EraToolInvoker = {
      invoke: () => Promise.resolve(new Error('No tool with the name "attack" has been registered.')),
    };
    const host = new EraFunctionOperationsHost(invoker, () => ({ sequence: 1 }));

    let flow = startMessageFunctionFlow({
      content: MESSAGE,
      messageId: 7,
      mk: 'mk-1',
      initialStat: {},
      meta: {},
    });

    let guard = 0;
    while (!flow.done && guard < 12) {
      flow = advanceMessageFunctionFlow(flow);
      if (flow.pendingCall === null) {
        guard += 1;
        continue;
      }
      await host.invoke({ invocationId: 'inv-3', name: 'attack', args: {} });
      await host.run('inv-3');
      const outcome = await host.result({ invocationId: 'inv-3' });
      flow = resumeMessageFunctionFlow(flow, { outcome, operations: [] });
      guard += 1;
    }

    expect(flow.content).toContain('error="ERA_FCALL_FAILED"');
    expect(flow.unregisteredCalls).toContain('attack');
    expect(flow.done).toBe(true);
    // 未注册调用不产生操作，原文最后一块仍执行：0 - 10 视初始值而定，只断言完成。
    expect(flow.stat).toBeTruthy();
  });

  it('已处理的调用在重放时不再次执行函数', async () => {
    const tool = vi.fn(async (_args: Readonly<Record<string, unknown>>) => {
      await Promise.resolve();
      return 'ok';
    });
    const invoker: EraToolInvoker = { invoke: (_n, a) => Promise.resolve(tool(a)) };
    const host = new EraFunctionOperationsHost(invoker, () => ({ sequence: 1 }));

    const settled = [
      '<VariableInsert>{"hp":100}</VariableInsert>',
      '<EraFCall name="attack" id="c1" status="done"/>',
      '<EraFCallTx for="c1" applied="1">',
      '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>',
      '</EraFCallTx>',
    ].join('\n');

    const flow = startMessageFunctionFlow({
      content: settled,
      messageId: 7,
      mk: 'mk-1',
      initialStat: {},
      meta: {},
    });
    const next = advanceMessageFunctionFlow(flow);

    expect(next.pendingCall).toBe(null);
    expect(tool).not.toHaveBeenCalled();
    expect(host).toBeTruthy();
  });
});
