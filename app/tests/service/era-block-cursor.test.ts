import { describe, expect, it } from 'vitest';

import {
  advanceEraBlockCursor,
  createEraBlockCursor,
  type EraBlockCursor,
} from '../../../javascript_project/service/base_lib/domain/message_function_calls';

function advance(
  content: string,
  cursor: EraBlockCursor,
  options: {
    readonly formal?: boolean;
    readonly stat?: unknown;
    readonly statFunc?: Readonly<Record<string, unknown>>;
  } = {},
) {
  return advanceEraBlockCursor({
    content,
    messageId: 7,
    cursor,
    initialStat: options.stat ?? { hp: 100, tmp: true },
    ...(options.statFunc === undefined ? {} : { initialStatFunc: options.statFunc }),
    meta: {},
    randomSourceKey: 'mk-1',
    formal: options.formal ?? true,
  });
}

describe('ERA 一步一块：块游标推进', () => {
  it('新游标从第 0 块开始，且不携带任何累计状态', () => {
    const cursor = createEraBlockCursor({ messageId: 7, mk: 'mk-1' });

    expect(cursor.blockIndex).toBe(0);
    expect(cursor.messageId).toBe(7);
    expect(cursor.mk).toBe('mk-1');
    expect(cursor.done).toBe(false);
  });

  it('每推进一次只执行一个块，然后停下等待下一步', () => {
    const content = [
      '<VariableInsert>{"hp":100}</VariableInsert>',
      '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>',
    ].join('\n');
    const first = advance(content, createEraBlockCursor({ messageId: 7, mk: 'mk-1' }));

    expect(first.executedBlockIndexes).toEqual([0]);
    expect(first.cursor.blockIndex).toBe(1);
    expect(first.cursor.done).toBe(false);
    expect(first.finalStat).toEqual({ hp: 100, tmp: true });

    const second = advance(content, first.cursor);
    expect(second.executedBlockIndexes).toEqual([1]);
    expect(second.finalStat).toEqual({ hp: 70, tmp: true });

    const third = advance(content, second.cursor);
    expect(third.executedBlockIndexes).toEqual([]);
    expect(third.cursor.done).toBe(true);
  });

  it('块间调用位置停止推进，并把待调用交给调用方', () => {
    const content = [
      '<VariableInsert>{"hp":100}</VariableInsert>',
      '<EraFCall name="attack" args=\'{"damage":30}\' id="c1"/>',
      '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>',
    ].join('\n');
    const first = advance(content, createEraBlockCursor({ messageId: 7, mk: 'mk-1' }));
    expect(first.executedBlockIndexes).toEqual([0]);

    const second = advance(content, first.cursor);
    expect(second.executedBlockIndexes).toEqual([]);
    expect(second.pendingCall?.callId).toBe('c1');
    expect(second.pendingCall?.name).toBe('attack');
    expect(second.cursor.blockIndex).toBe(1);
    expect(second.cursor.done).toBe(false);
  });

  it('已处理调用不再要求调用，只重放其操作区的操作', () => {
    const content = [
      '<EraFCall name="attack" id="c1" status="done"/>',
      '<EraFCallTx for="c1">',
      '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>',
      '</EraFCallTx>',
    ].join('\n');
    let cursor = createEraBlockCursor({ messageId: 7, mk: 'mk-1' });

    const first = advance(content, cursor);
    expect(first.pendingCall).toBe(null);
    // 调用块本身不产生变量操作：它消费一步，但 executedBlockIndexes 为空。
    expect(first.executedBlockIndexes).toEqual([]);
    expect(first.cursor.blockIndex).toBe(1);

    cursor = first.cursor;
    const second = advance(content, cursor);
    expect(second.executedBlockIndexes).toEqual([1]);
    expect(second.finalStat).toEqual({ hp: 70, tmp: true });

    const third = advance(content, second.cursor);
    expect(third.cursor.done).toBe(true);
    expect(third.pendingCall).toBe(null);
  });

  it('纯计算模式跳过所有未标记调用且不产生待调用', () => {
    const content = ['<EraFCall name="attack" id="c1"/>', '<VariableInsert>{"hp":100}</VariableInsert>'].join('\n');
    const first = advance(content, createEraBlockCursor({ messageId: 7, mk: 'mk-1' }), {
      formal: false,
    });

    expect(first.pendingCall).toBe(null);
    expect(first.executedBlockIndexes).toEqual([]);
    expect(first.diagnostics.map(item => item.code)).toContain('ERA_FCALL_NOT_EXECUTED');

    const second = advance(content, first.cursor, { formal: false });
    expect(second.executedBlockIndexes).toEqual([1]);
    expect(second.finalStat).toEqual({ hp: 100, tmp: true });
    expect(second.cursor.done).toBe(true);
  });

  it('嵌套调用块不执行也不阻断：先执行指令块，再以诊断消费该调用块', () => {
    const content =
      '<VariableInsert>{"gold":5}</VariableInsert>\n<VariableEdit>{"note":"<EraFCall name=\\"dice\\"/>"}</VariableEdit>';
    const first = advance(content, createEraBlockCursor({ messageId: 7, mk: 'mk-1' }));
    expect(first.executedBlockIndexes).toEqual([0]);
    expect(first.finalStat).toMatchObject({ gold: 5 });

    const second = advance(content, first.cursor, { stat: first.finalStat });
    expect(second.executedBlockIndexes).toEqual([1]);
    expect(second.pendingCall).toBe(null);

    const third = advance(content, second.cursor, { stat: second.finalStat });
    const codes = third.diagnostics.map(item => item.code);
    expect(codes).toContain('ERA_FCALL_NESTED');
    // 该调用嵌在 JSON 字符串里，属性本身也带转义，因此同时报告缺少可用 name。
    expect(codes).toContain('ERA_FCALL_NAME_REQUIRED');
    expect(third.pendingCall).toBe(null);
    expect(third.cursor.done).toBe(true);
  });

  it('推进保持累计变量与函数状态，跨块连续生效', () => {
    const content = [
      '<VariableInsert>{"hp":100}</VariableInsert>',
      '<FunctionInsert>{"double":{"params":["x"],"expr":"x * 2"}}</FunctionInsert>',
      '<VariableEdit>{"hp":{"$expr":"double(35)"}}</VariableEdit>',
    ].join('\n');
    const stat: unknown = { tmp: false };

    const first = advance(content, createEraBlockCursor({ messageId: 7, mk: 'mk-1' }), { stat });
    expect(first.finalStat).toEqual({ hp: 100, tmp: false });
    expect(first.finalStatFunc).toBeUndefined();

    // 第二个块是 FunctionInsert：它不改变量，但必须把函数库交给下一步。
    const second = advance(content, first.cursor, { stat: first.finalStat });
    expect(second.executedBlockIndexes).toEqual([1]);
    expect(second.finalStatFunc).toEqual({
      double: { params: ['x'], expr: 'x * 2' },
    });

    // 第三个块必须带上第二步建立的函数库才能求值。
    const third = advance(content, second.cursor, {
      stat: second.finalStat,
      statFunc: second.finalStatFunc,
    });
    expect(third.pendingCall).toBe(null);
    expect(third.finalStat).toEqual({ hp: 70, tmp: false });
    expect(third.diagnostics).toEqual([]);
  });
});
