import { describe, expect, it } from 'vitest';

import {
  DEFAULT_COLLECTION_WINDOW_MS,
  getCollectionWindowMs,
  getEventDefinition,
  INPUT_EVENT,
  shouldCloseCollectionWindow,
} from '../../src/ERA变量框架/events/catalog';

describe('事件目录', () => {
  it('集中声明默认、swipe、updated 与生成边界的收集时间', () => {
    expect(DEFAULT_COLLECTION_WINDOW_MS).toBe(100);
    expect(getCollectionWindowMs('unknown-event')).toBe(100);
    expect(getCollectionWindowMs(INPUT_EVENT.MESSAGE_SWIPED)).toBe(500);
    expect(getCollectionWindowMs(INPUT_EVENT.MESSAGE_UPDATED)).toBe(1500);
    expect(getCollectionWindowMs(INPUT_EVENT.GENERATION_STARTED)).toBe(0);
  });

  it('MESSAGE_SWIPED 始终 detached，而 GENERATION_STARTED 是 first barrier', () => {
    expect(getEventDefinition(INPUT_EVENT.MESSAGE_SWIPED)).toMatchObject({
      listenerOrder: 'normal',
      awaitMode: 'detached',
    });
    expect(getEventDefinition(INPUT_EVENT.GENERATION_STARTED)).toMatchObject({
      listenerOrder: 'first',
      awaitMode: 'generation-barrier',
    });
  });

  it('只有生成边界声明为立即关闭当前收集窗口', () => {
    expect(shouldCloseCollectionWindow(INPUT_EVENT.MESSAGE_SWIPED)).toBe(false);
    expect(shouldCloseCollectionWindow(INPUT_EVENT.MESSAGE_UPDATED)).toBe(false);
    expect(shouldCloseCollectionWindow(INPUT_EVENT.GENERATION_STARTED)).toBe(true);
  });
});
