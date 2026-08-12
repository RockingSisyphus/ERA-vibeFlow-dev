import { describe, expect, it } from 'vitest';

type ApiWriteEngine = typeof import('../../../javascript_project/service/base_lib/domain/api_write_engine.ts');
const engineUrl = new URL('../../../javascript_project/service/base_lib/domain/api_write_engine.ts', import.meta.url)
  .href;
const engine = (await import(/* @vite-ignore */ engineUrl)) as ApiWriteEngine;

function candidateBlock(tag: string, value: unknown): string {
  return `\n<${tag}>\n${JSON.stringify(value, null, 2)}\n</${tag}>`;
}

describe('VibeFlow 六个 ERA 写入 API 纯适配差分', () => {
  it('对象插入、更新和删除逐字保持候选指令格式且不修改输入', () => {
    const detail = { player: { hp: 10, bag: [null, { name: '药水' }] } };
    const before = structuredClone(detail);
    const insert = engine.prepareApiWriteDirective('era:insertByObject', detail);
    const update = engine.prepareApiWriteDirective('era:updateByObject', detail);
    const remove = engine.prepareApiWriteDirective('era:deleteByObject', detail);
    expect(insert.block).toBe(candidateBlock('VariableInsert', detail));
    expect(update.block).toBe(candidateBlock('VariableEdit', detail));
    expect(remove.block).toBe(candidateBlock('VariableDelete', detail));
    expect(detail).toEqual(before);
  });

  it('路径写入支持点、数组和引号下标，并按删除语义写入空对象', () => {
    expect(
      engine.prepareApiWriteDirective('era:insertByPath', { path: 'player.inventory[0]', value: 3 }).blockContent,
    ).toEqual({ player: { inventory: [3] } });
    expect(
      engine.prepareApiWriteDirective('era:updateByPath', { path: 'player["a.b"].hp', value: '+=10' }).blockContent,
    ).toEqual({ player: { 'a.b': { hp: '+=10' } } });
    const deleted = engine.prepareApiWriteDirective('era:deleteByPath', { path: 'player.inventory[1]' });
    const inventory = (deleted.blockContent.player as { inventory: unknown[] }).inventory;
    expect(inventory).toHaveLength(2);
    expect(0 in inventory).toBe(false);
    expect(inventory[1]).toEqual({});
    expect(deleted.block).toBe(candidateBlock('VariableDelete', { player: { inventory: [null, {}] } }));
  });

  it('拒绝非对象 detail、未知事件和原型链路径', () => {
    expect(() => engine.prepareApiWriteDirective('era:insertByObject', null)).toThrow(
      'ERA API 事件需要对象形式的 detail',
    );
    expect(() => engine.prepareApiWriteDirective('era:unknown', {})).toThrow('不是已登记的 ERA 写入 API');
    expect(() =>
      engine.prepareApiWriteDirective('era:updateByPath', { path: '__proto__.polluted', value: true }),
    ).toThrow('不允许的段');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('选择最后一条 AI 消息，MK message-type 优先于 role', () => {
    const directive = engine.prepareApiWriteDirective('era:insertByObject', { gold: 5 });
    const messages = [
      { schemaVersion: 1, messageId: 0, role: 'assistant', activeText: 'AI-0', swipeIndex: null },
      {
        schemaVersion: 1,
        messageId: 1,
        role: 'assistant',
        activeText: '<era_data>{"era-message-key"="u1","era-message-type"="user"}</era_data>',
        swipeIndex: null,
      },
      { schemaVersion: 1, messageId: 2, role: 'assistant', activeText: 'AI-2', swipeIndex: 1 },
    ];
    const before = structuredClone(messages);
    const plan = engine.planApiMessageAppend({ messages }, directive);
    expect(plan).toMatchObject({ messageId: 2, originalContent: 'AI-2' });
    expect(plan.newContent).toBe(`AI-2${candidateBlock('VariableInsert', { gold: 5 })}`);
    expect(plan.update).toEqual({ messageId: 2, content: plan.newContent });
    expect(messages).toEqual(before);
    expect(plan.update).not.toHaveProperty('swipes');
  });

  it('严格消息投影只产生局部文本命令，不复制宿主 swipe 或附件', () => {
    const directive = engine.prepareApiWriteDirective('era:deleteByPath', { path: 'world.flag' });
    const message = {
      schemaVersion: 1,
      messageId: 9,
      role: 'assistant',
      activeText: '当前文本',
      swipeIndex: 1,
    };
    const plan = engine.planApiMessageAppend([message], directive);
    expect(plan.update).toEqual({
      messageId: 9,
      content: `当前文本${candidateBlock('VariableDelete', { world: { flag: {} } })}`,
    });
  });

  it('空聊天或全为用户消息时保持候选失败语义', () => {
    const directive = engine.prepareApiWriteDirective('era:insertByObject', { a: 1 });
    expect(() => engine.planApiMessageAppend([], directive)).toThrow('找不到任何 AI 消息');
    expect(() =>
      engine.planApiMessageAppend(
        [{ schemaVersion: 1, messageId: 0, role: 'user', activeText: '用户', swipeIndex: null }],
        directive,
      ),
    ).toThrow('找不到任何 AI 消息');
  });
});
