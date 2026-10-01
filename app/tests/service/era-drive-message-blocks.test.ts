import { describe, expect, it } from 'vitest';
import { execute } from './memory-batch-fixture';
import { contextWith } from './memory-lifecycle-fixture';
import { planEraSync } from '../../../javascript_project/service/base_lib/sync/sync_planning';
import { run as advanceBlock } from './message-block-fixture';
import { vi } from 'vitest';

// The former per-block disk pipeline is replaced by the approved memory publication pipeline.
// Keep its rollback/expression/history conditions against the actual production nodes.
describe('正式内存块链的历史与恢复', () => {
  it.each([0, 1])('历史截断到空执行范围时直接收尾，不访问不存在的作者帧（越界偏移 %i）', async offset => {
    const acknowledge = vi.fn();
    const next = vi.fn();
    const release = vi.fn();
    const work = {
      disposition: 'ready',
      plan: { status: 'ready', execution: { messageIndex: 2 + offset, endIndex: 2 }, diagnostics: [] },
    };
    const result = await advanceBlock(
      { 'era.sync.block.step.state': { value: { done: false, work } } },
      {},
      { capabilities: { 'era.tavern.functions': { acknowledge, next, release } } },
    );
    expect(result.block_step_pending.done).toBe(true);
    expect(result.block_step_pending.work.plan.execution).toBeNull();
    expect(result.block_step_pending.work.disposition).toBe('ready');
    expect(result.block_step_pending.work.failure).toBeUndefined();
    expect(acknowledge).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });
  it('定向正文先补齐新增用户楼层，结算回退保留历史变量和函数且止于目标楼层', () => {
    const message = (messageId: number, role: string, text: string) => ({
      messageId,
      role,
      content: {
        kind: 'text' as const,
        text: `${text}<era_data>{"era-message-key"="mk-${messageId}","era-message-type"="${role}"}</era_data>`,
      },
    });
    const history = planEraSync({
      messages: [
        message(
          0,
          'assistant',
          '<VariableInsert>{"history":{"hp":17}}</VariableInsert><FunctionInsert>{"f":{"params":["x"],"expr":"x*3"}}</FunctionInsert>',
        ),
      ],
      stat: {},
      meta: {},
      reason: 'manual',
      processingMk: 'mk-0',
      consecutiveState: { mk: null, count: 0 },
    });
    const messages = [
      ...history.messages,
      message(1, 'user', '继续'),
      message(2, 'assistant', '正文'),
      message(3, 'assistant', '<VariableDelete>{"history":""}</VariableDelete>'),
    ];
    const story = planEraSync({
      messages,
      stat: history.stat,
      statFunc: history.statFunc,
      meta: history.meta,
      reason: 'manual',
      processingMk: 'mk-2',
      consecutiveState: { mk: null, count: 0 },
      targetMessageId: 2,
      stopAtTarget: true,
    });
    expect(story.meta.SelectedMks).toEqual(['mk-0', 'mk-1', 'mk-2']);
    const settled = planEraSync({
      messages: story.messages.map(m =>
        m.messageId === 2 ? message(2, 'assistant', '<VariableInsert>{"settled":1}</VariableInsert>') : m,
      ),
      stat: story.stat,
      statFunc: story.statFunc,
      meta: story.meta,
      reason: 'manual',
      processingMk: 'mk-2',
      consecutiveState: { mk: null, count: 0 },
      targetMessageId: 2,
      stopAtTarget: true,
    });
    expect(settled.stat).toEqual({ history: { hp: 17 }, settled: 1 });
    expect(settled.statFunc).toEqual(history.statFunc);
  });
  it('done 跳过，旧 applied 操作区的普通指令仍按位置应用', async () => {
    const result = await execute(
      '<EraFCall name="a" status="done"/><EraFCallTx for="c" applied="1"><VariableEdit>{"hp":70}</VariableEdit></EraFCallTx><VariableEdit>{"hp":{"$expr":"hp*2"}}</VariableEdit>',
    );
    expect(result.working.record.state.statData.hp).toBe(140);
    expect(result.writes[0].updates[0].message).toContain('status="done"');
  });
  it('文件保存失败后，刷新以实际聊天和旧Sidecar恢复，不能重复扣值', async () => {
    const text = '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>'.repeat(3);
    const failed = await execute(text, { failSave: true });
    expect(failed.outcome.status).toBe('failed');
    const actual = failed.writes[0].updates[0].message;
    const fresh = contextWith(actual, { hp: 100 });
    const resumed = await execute(actual, { context: fresh });
    expect(resumed.working.record.state.statData.hp).toBe(70);
    expect(resumed.writes[0].updates[0].message).not.toContain('era_block');
  });
  it('当前函数与消息起点函数分开', async () => {
    const text =
      '<FunctionEdit>{"f":{"params":["x"],"expr":"x*3"}}</FunctionEdit><VariableEdit>{"hp":{"$expr":"@f(hp)"}}</VariableEdit>';
    const context = contextWith(text);
    context.variablesRaw.statFunc = { f: { params: ['x'], expr: 'x*2' } };
    const result = await execute(text, { context });
    expect(result.working.record.state.statData.hp).toBe(200);
    expect(result.working.record.state.statFunc.f.expr).toBe('x*3');
  });
  it('连续随机抽取在落盘后的刷新和历史重算中一致', async () => {
    const text = '<VariableEdit>{"hp":{"$expr":"random()"}}</VariableEdit>'.repeat(4);
    const whole = await execute(text);
    const actual = whole.writes[0].updates[0].message;
    const fresh = contextWith(actual, whole.working.record.state.statData);
    fresh.variablesRaw.ERAMetaData = whole.working.record.state.eraMeta;
    const resumed = await execute(actual, { context: fresh });
    expect(resumed.working.record.state.statData).toEqual(whole.working.record.state.statData);
    const replay = planEraSync({
      messages: resumed.state.work.plan.messages,
      stat: resumed.working.record.state.statData,
      statFunc: {},
      meta: resumed.working.record.state.eraMeta,
      reason: 'manual',
      processingMk: null,
      consecutiveState: null,
    });
    expect(replay.stat).toEqual(whole.working.record.state.statData);
  });
});
