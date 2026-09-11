import { describe, expect, it } from 'vitest';

import {
  cursorFromMessageFunctionFlow,
  rehydrateMessageFunctionFlow,
  startMessageFunctionFlow,
  advanceMessageFunctionFlow,
} from '../../../javascript_project/service/base_lib/domain/message_function_flow';

const MESSAGE = [
  '<VariableInsert>{"hp":100}</VariableInsert>',
  '<EraFCall name="attack" id="c1"/>',
  '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
].join('\n');

function advancedOnce() {
  const flow = startMessageFunctionFlow({
    content: MESSAGE,
    messageId: 7,
    mk: 'mk-1',
    initialStat: { gold: 1 },
    meta: {},
  });
  return advanceMessageFunctionFlow(flow);
}

describe('ERA 一步一块：跨批次游标转换', () => {
  it('游标只携带可持久化的最小字段，不含正文与元数据', () => {
    const cursor = cursorFromMessageFunctionFlow(advancedOnce());

    expect(cursor).toMatchObject({
      messageId: 7,
      mk: 'mk-1',
      blockIndex: 1,
    });
    // 正文与元数据体积不可控，且可由宿主重新读取，不能进入服务状态。
    expect(cursor).not.toHaveProperty('content');
    expect(cursor).not.toHaveProperty('meta');
    expect(JSON.parse(JSON.stringify(cursor))).toEqual(cursor);
  });

  it('游标不携带累计变量，避免服务状态随业务数据膨胀', () => {
    const cursor = cursorFromMessageFunctionFlow(advancedOnce());

    expect(cursor).not.toHaveProperty('stat');
    expect(cursor).not.toHaveProperty('statFunc');
  });

  it('恢复后从游标位置继续，而不是从楼层起点重来', () => {
    const flow = advancedOnce();
    const cursor = cursorFromMessageFunctionFlow(flow);

    const restored = rehydrateMessageFunctionFlow({
      cursor,
      content: MESSAGE,
      messageId: 7,
      mk: 'mk-1',
      initialStat: flow.stat,
      meta: {},
    });

    expect(restored.cursor.blockIndex).toBe(cursor.blockIndex);
    expect(restored.stat).toEqual(flow.stat);
    expect(restored.done).toBe(false);
  });

  it('恢复后可继续推进并停在调用块上', () => {
    const flow = advancedOnce();
    const restored = rehydrateMessageFunctionFlow({
      cursor: cursorFromMessageFunctionFlow(flow),
      content: MESSAGE,
      messageId: 7,
      mk: 'mk-1',
      initialStat: flow.stat,
      meta: {},
    });

    const next = advanceMessageFunctionFlow(restored);
    expect(next.pendingCall?.callId).toBe('c1');
  });

  it('游标需要与楼层身份匹配：MK 变化时拒绝恢复', () => {
    const cursor = cursorFromMessageFunctionFlow(advancedOnce());

    expect(() =>
      rehydrateMessageFunctionFlow({
        cursor,
        content: MESSAGE,
        messageId: 7,
        mk: 'mk-OTHER',
        initialStat: { gold: 1 },
        meta: {},
      }),
    ).toThrow(/ERA_SYNC_CURSOR_IDENTITY/);
  });

  it('已完成的游标恢复后即为完成态，不需要再推进', () => {
    const cursor = {
      messageId: 7,
      mk: 'mk-1',
      blockIndex: 3,
      done: true,
    };

    const restored = rehydrateMessageFunctionFlow({
      cursor,
      content: MESSAGE,
      messageId: 7,
      mk: 'mk-1',
      initialStat: { gold: 1 },
      meta: {},
    });

    expect(restored.done).toBe(true);
    const next = advanceMessageFunctionFlow(restored);
    expect(next.executedBlockIndexes).toEqual([]);
  });
});
