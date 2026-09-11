import { describe, expect, it } from 'vitest';

import {
  advanceEraBlockSession,
  createEraBlockCursor,
  startEraBlockSession,
  type EraBlockCursor,
} from '../../../javascript_project/service/base_lib/domain/message_function_calls';

const MESSAGE = [
  '<VariableInsert>{"hp":100}</VariableInsert>',
  '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>',
  '<EraFCall name="attack" args=\'{"damage":10}\' id="c1"/>',
  '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
].join('\n');

function session(stat: unknown = { gold: 1 }) {
  return startEraBlockSession({
    content: MESSAGE,
    messageId: 7,
    mk: 'mk-1',
    initialStat: stat,
    meta: {},
  });
}

describe('ERA 一步一块：可续做消息重放会话', () => {
  it('会话从第 0 块开始，累计状态等于输入状态', () => {
    const s = session({ gold: 1 });

    expect(s.cursor.blockIndex).toBe(0);
    expect(s.done).toBe(false);
    expect(s.stat).toEqual({ gold: 1 });
    expect(s.editLog).toEqual([]);
    expect(s.pendingCall).toBe(null);
  });

  it('每次推进只执行一个块，并在调用处停下等待调用方处理', () => {
    let s = session({ gold: 1 });

    s = advanceEraBlockSession(s);
    expect(s.executedBlockIndexes).toEqual([0]);
    expect(s.stat).toEqual({ hp: 100, gold: 1 });

    s = advanceEraBlockSession(s);
    expect(s.executedBlockIndexes).toEqual([1]);
    expect(s.stat).toEqual({ hp: 70, gold: 1 });

    // 第三个块是调用：本步不产生操作，pendingCall 交给调用方。
    s = advanceEraBlockSession(s);
    expect(s.executedBlockIndexes).toEqual([]);
    expect(s.pendingCall?.callId).toBe('c1');
    expect(s.done).toBe(false);
    expect(s.cursor.blockIndex).toBe(2);
  });

  it('会话累计本楼的编辑日志增量，供提交边界一次取出', () => {
    let s = session({ gold: 1 });

    s = advanceEraBlockSession(s);
    expect(s.editLog.map(entry => entry.path)).toEqual(['hp']);

    s = advanceEraBlockSession(s);
    expect(s.editLog.length).toBeGreaterThanOrEqual(1);
    expect(s.editLog.map(entry => entry.path)).toContain('hp');
  });

  it('全部块处理完才置 done，且后续推进不再改变状态', () => {
    let s = session({ gold: 1 });
    let guard = 0;
    while (!s.done && guard < 12) {
      s = advanceEraBlockSession(s, s.pendingCall === null ? {} : { resolvePendingCall: true });
      guard += 1;
    }

    expect(s.done).toBe(true);
    expect(s.pendingCall).toBe(null);
    expect(s.stat).toEqual({ hp: 60, gold: 1 });

    const again = advanceEraBlockSession(s);
    expect(again.done).toBe(true);
    expect(again.stat).toEqual(s.stat);
    expect(again.executedBlockIndexes).toEqual([]);
  });

  it('resolvePendingCall 把调用块视为已处理，继续推进操作区', () => {
    let s = session({ gold: 1 });
    s = advanceEraBlockSession(s);
    s = advanceEraBlockSession(s);
    s = advanceEraBlockSession(s);
    expect(s.pendingCall).not.toBe(null);

    // 调用方完成函数并把它写为已处理后，清除待调用。
    const cleared = advanceEraBlockSession(s, { resolvePendingCall: true });
    expect(cleared.pendingCall).toBe(null);
    expect(cleared.cursor.blockIndex).toBe(2);

    // 下一次推进跳过已处理的调用块，继续走调用块下方保存的操作。
    const resumed = advanceEraBlockSession(cleared);
    expect(resumed.pendingCall).toBe(null);
    expect(resumed.cursor.blockIndex).toBeGreaterThan(2);
  });

  it('纯计算模式跳过未标记调用并记录未执行诊断', () => {
    let s = startEraBlockSession({
      content: MESSAGE,
      messageId: 7,
      mk: 'mk-1',
      initialStat: { gold: 1 },
      meta: {},
      formal: false,
    });
    const codes: string[] = [];
    let guard = 0;
    while (!s.done && guard < 10) {
      s = advanceEraBlockSession(s);
      codes.push(...s.diagnostics.map(item => item.code));
      guard += 1;
    }

    expect(s.pendingCall).toBe(null);
    expect(codes).toContain('ERA_FCALL_NOT_EXECUTED');
    expect(s.stat).toEqual({ hp: 60, gold: 1 });
  });

  it('带操作区的已处理调用不触发 pendingCall，操作区按普通块执行', () => {
    const content = [
      '<EraFCall name="attack" id="c1" status="done"/>',
      '<EraFCallTx for="c1">',
      '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>',
      '</EraFCallTx>',
    ].join('\n');
    let s = startEraBlockSession({
      content,
      messageId: 7,
      mk: 'mk-1',
      initialStat: { hp: 100 },
      meta: {},
    });

    const pending: unknown[] = [];
    let guard = 0;
    while (!s.done && guard < 10) {
      s = advanceEraBlockSession(s);
      if (s.pendingCall !== null) pending.push(s.pendingCall);
      guard += 1;
    }

    expect(pending).toEqual([]);
    expect(s.stat).toEqual({ hp: 70 });
    expect(s.done).toBe(true);
  });

  it('会话接受既有游标以便跨步骤续做', () => {
    let s = session({ gold: 1 });
    s = advanceEraBlockSession(s);
    const cursor: EraBlockCursor = s.cursor;

    const resumed = startEraBlockSession({
      content: MESSAGE,
      messageId: 7,
      mk: 'mk-1',
      initialStat: s.stat,
      meta: {},
      cursor,
    });

    expect(resumed.cursor.blockIndex).toBe(1);
    expect(resumed.stat).toEqual(s.stat);
    expect(createEraBlockCursor({ messageId: 7, mk: 'mk-1' }).blockIndex).toBe(0);
  });
});
