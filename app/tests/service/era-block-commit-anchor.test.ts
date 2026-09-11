/**
 * 逐块提交的位置锚定落点。
 *
 * 锁定语义：每个操作块执行完都要提交一次状态，并在**该块的位置**留下记录。既有即时
 * 提交是追加到消息末尾，若逐块提交也追加，重放顺序会与实时顺序不一致，对非交换操作
 * 会算出不同终值。因此提交载荷必须能带位置锚点。
 */

import { describe, expect, it } from 'vitest';

const engineUrl = new URL(
  '../../../javascript_project/service/base_lib/facade_api_engine.ts',
  import.meta.url,
).href;
const engine = await import(/* @vite-ignore */ engineUrl);

const MESSAGE = [
  '<VariableInsert>{"hp":100}</VariableInsert>',
  '<EraFCall name="attack" args=\'{"damage":30}\' id="c1"/>',
  '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
].join('\n');

function appendWith(position: unknown) {
  return engine.buildAppend({
    schemaVersion: 1,
    latest: { messageId: 3, activeText: MESSAGE },
    transaction: '<era_tx s="m"><VariableEdit>{"hp":{"$expr":"hp+30"}}</VariableEdit></era_tx>',
    ...(position === undefined ? {} : { position }),
  });
}

describe('逐块提交的位置锚定落点', () => {
  it('没有位置锚点时保持既有追加语义', () => {
    const appended = appendWith(undefined);

    expect(appended.committedContent).toBe(
      `${MESSAGE}\n<era_tx s="m"><VariableEdit>{"hp":{"$expr":"hp+30"}}</VariableEdit></era_tx>`,
    );
  });

  it('锚定到调用块：记录紧随该调用块，并同时标记已处理', () => {
    const appended = appendWith({ callId: 'c1' });
    const text: string = appended.committedContent;

    expect(text).toContain('<EraFCall name="attack" args=\'{"damage":30}\' id="c1" status="done"/>');
    // 记录必须落在调用块之后、后续块之前。
    expect(text.indexOf('<EraFCallTx') === -1).toBe(true);
    expect(text.indexOf('<era_tx s="m">')).toBeGreaterThan(text.indexOf('id="c1" status="done"'));
    expect(text.indexOf('<era_tx s="m">')).toBeLessThan(text.indexOf('hp-10'));
    // 原文其余部分不得被改动。
    expect(text.startsWith('<VariableInsert>{"hp":100}</VariableInsert>')).toBe(true);
    expect(text.endsWith('<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>')).toBe(true);
  });

  it('锚定到原文偏移：记录插在该偏移之后', () => {
    const offset = MESSAGE.indexOf('\n<VariableEdit>');
    const text: string = appendWith({ afterOffset: offset }).committedContent;

    expect(text.indexOf('<era_tx s="m">')).toBeLessThan(text.indexOf('<VariableEdit>{"hp":{"$expr":"hp-10"}}'));
    expect(text.indexOf('<era_tx s="m">')).toBeGreaterThan(text.indexOf('id="c1"'));
  });

  it('锚点找不到时退回追加，不静默丢记录', () => {
    const text: string = appendWith({ callId: 'missing' }).committedContent;

    expect(text).toBe(
      `${MESSAGE}\n<era_tx s="m"><VariableEdit>{"hp":{"$expr":"hp+30"}}</VariableEdit></era_tx>`,
    );
  });
});
