import { describe, expect, it } from 'vitest';

import {
  advanceMessageFunctionFlow,
  startMessageFunctionFlow,
  resumeMessageFunctionFlow,
  type MessageFunctionFlow,
} from '../../../javascript_project/service/base_lib/domain/message_function_flow';

const MESSAGE = [
  '<VariableInsert>{"hp":100}</VariableInsert>',
  '<EraFCall name="attack" args=\'{"damage":30}\' id="c1"/>',
  '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
].join('\n');

function flow(stat: unknown = { gold: 1 }): MessageFunctionFlow {
  return startMessageFunctionFlow({
    content: MESSAGE,
    messageId: 7,
    mk: 'mk-1',
    initialStat: stat,
    meta: {},
  });
}

describe('ERA 一步一块：Service 侧消息函数流程（纯状态机）', () => {
  it('逐块推进，并在调用块处停下等待宿主机执行函数', () => {
    let current = flow();

    current = advanceMessageFunctionFlow(current);
    expect(current.executedBlockIndexes).toEqual([0]);
    expect(current.stat).toEqual({ gold: 1, hp: 100 });

    current = advanceMessageFunctionFlow(current);
    expect(current.pendingCall?.callId).toBe('c1');
    expect(current.done).toBe(false);
  });

  it('宿主机回送结果后写回调用块下方的操作区并继续推进', () => {
    let current = flow();
    current = advanceMessageFunctionFlow(current);
    current = advanceMessageFunctionFlow(current);

    current = resumeMessageFunctionFlow(current, {
      outcome: { status: 'completed', name: 'attack', result: 'ok', message: '', unregistered: false },
      operations: [{ edit: { hp: { $expr: 'hp - 30' } } }],
    });

    expect(current.content).toContain('<EraFCallTx for="c1" applied="1">');
    expect(current.content).toContain('hp - 30');
    expect(current.content).toContain('status="done"');
    expect(current.pendingCall).toBe(null);
  });

  it('全部块处理完后 done 为真，且状态与顺序一致', () => {
    let current = flow();
    let guard = 0;
    while (!current.done && guard < 10) {
      current = advanceMessageFunctionFlow(current);
      if (current.pendingCall !== null) {
        current = resumeMessageFunctionFlow(current, {
          outcome: { status: 'completed', name: 'attack', result: 'ok', message: '', unregistered: false },
          operations: [{ edit: { hp: { $expr: 'hp - 30' } } }],
        });
      }
      guard += 1;
    }

    expect(current.done).toBe(true);
    // 100 - 30（函数，就地应用）= 70，再执行原文最后一块 -10 = 60；已应用操作区不重放。
    expect(current.stat).toEqual({ gold: 1, hp: 60 });
  });

  it('函数失败时写入失败标记，保留已应用操作并继续', () => {
    let current = flow();
    current = advanceMessageFunctionFlow(current);
    current = advanceMessageFunctionFlow(current);

    current = resumeMessageFunctionFlow(current, {
      outcome: { status: 'failed', name: 'attack', result: null, message: 'boom', unregistered: false },
      operations: [{ edit: { hp: { $expr: 'hp - 30' } } }],
    });

    expect(current.content).toContain('error="ERA_FCALL_FAILED"');
    expect(current.stat).toEqual({ gold: 1, hp: 70 });
  });

  it('未注册调用同样以失败标记收口，并保留未注册事实', () => {
    let current = flow();
    current = advanceMessageFunctionFlow(current);
    current = advanceMessageFunctionFlow(current);

    current = resumeMessageFunctionFlow(current, {
      outcome: {
        status: 'failed',
        name: 'attack',
        result: null,
        message: 'No tool with the name "attack" has been registered.',
        unregistered: true,
      },
      operations: [],
    });

    expect(current.content).toContain('error="ERA_FCALL_FAILED"');
    expect(current.content).toContain('<EraFCallTx for="c1" applied="1"></EraFCallTx>');
    expect(current.unregisteredCalls).toContain('attack');
  });

  it('纯计算模式不产生待调用，只记录未执行诊断', () => {
    let current = startMessageFunctionFlow({
      content: MESSAGE,
      messageId: 7,
      mk: 'mk-1',
      initialStat: { gold: 1 },
      meta: {},
      formal: false,
    });

    let guard = 0;
    while (!current.done && guard < 10) {
      current = advanceMessageFunctionFlow(current);
      guard += 1;
    }

    expect(current.pendingCall).toBe(null);
    expect(current.diagnostics.map(item => item.code)).toContain('ERA_FCALL_NOT_EXECUTED');
    expect(current.content).not.toContain('<EraFCallTx');
  });

  it('取消后流程冻结，不再推进也不接受回送', () => {
    let current = flow();
    current = { ...current, cancelled: true };

    const after = advanceMessageFunctionFlow(current);
    expect(after.executedBlockIndexes).toEqual([]);
    const resumed = resumeMessageFunctionFlow(current, {
      outcome: { status: 'completed', name: 'attack', result: 'ok', message: '', unregistered: false },
      operations: [{ insert: { late: true } }],
    });
    expect(resumed.content).toBe(current.content);
  });
});
