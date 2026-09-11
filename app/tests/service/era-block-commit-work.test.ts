/**
 * 单块提交工作项构造（切片 1b 的纯构造部分）。
 *
 * 锁定语义要求每个操作块执行完就提交一次状态；既有提交链的 stat/statFunc/meta 全部取自
 * plan，所以单块提交靠「只含该块的 plan」表达，而不是新增提交通道。
 */

import { describe, expect, it } from 'vitest';

import {
  buildBlockCommitWork,
  buildCompletedFloorContent,
  buildPerBlockCommitWork,
} from '../../../javascript_project/service/base_lib/block_step_state';

function fixture() {
  const work = {
    schemaVersion: 1,
    step: { kind: 'execute' },
    disposition: 'no-op',
    plan: { meta: { SelectedMks: ['mk-1'] }, messages: [{ messageId: 4 }] },
    payload: { mk: 'mk-old', message_id: 1, is_user: false, actions: {}, consecutiveProcessingCount: 2 },
    failure: null,
  } as never;
  const state = {
    messageId: 4,
    mk: 'mk-4',
    blockIndex: 3,
    done: false,
    stat: { hp: 130 },
    statFunc: { f: { params: [], expr: '1' } },
    // 本批次开始时的已提交世界与连续处理事实；逐块提交与交接记录提交都从它们出发。
    baseStat: { hp: 100 },
    baseStatFunc: {},
    consecutive: { mk: null, count: 0 },
    executedBlockIndex: null,
    drawOffset: 0,
    route: 'none' as const,
    handoff: null,
    content: '消息正文',
    meta: {},
    work: {},
  };
  return { work, state };
}

describe('逐块提交：单块工作项构造', () => {
  it('产出的工作项声明提交，并携带该块之后的累计状态', () => {
    const { work, state } = fixture();
    const built = buildBlockCommitWork({
      work,
      state,
      content: '<VariableInsert>{"hp":100}</VariableInsert>',
      messageIndex: 0,
    });

    expect(built.disposition).toBe('commit');
    expect(built.plan?.stat).toEqual({ hp: 130 });
    expect(built.plan?.statFunc).toEqual(state.statFunc);
    // 元数据沿用既有工作项，不凭空造。
    expect(built.plan?.meta).toEqual({ SelectedMks: ['mk-1'] });
  });

  it('消息更新写在该楼层并带上锚定后的文本', () => {
    const { work, state } = fixture();
    const built = buildBlockCommitWork({
      work,
      state,
      content: '<EraFCall name="a" id="c1" status="done"/>\n<era_tx s="m"></era_tx>',
      messageIndex: 0,
    });

    expect(built.plan?.messageUpdates?.[0]).toMatchObject({
      kind: 'update-message-content',
      messageId: 4,
      messageIndex: 0,
      mk: 'mk-4',
      content: { kind: 'text', text: expect.stringContaining('<era_tx s="m">') },
    });
  });

  it('连续处理计数与 payload 身份与该块一致', () => {
    const { work, state } = fixture();
    const built = buildBlockCommitWork({ work, state, content: 'x', messageIndex: 0 });

    // payloadFor 要求计数是 >=1 的整数，否则构造 payload 会抛错。
    expect(built.plan?.consecutiveProcessingCount).toBeGreaterThanOrEqual(1);
    expect(built.payload).toMatchObject({ mk: 'mk-4', message_id: 4 });
  });
});

/**
 * 逐块提交的工作项（切片 1b 的写入者构造面）。
 *
 * 提交必须同时落「该块之后的状态」与「把该块包成已应用记录」：状态写进 sidecar 后 `stat`
 * 停在楼层中途，没有记录就无法知道前几块算过。楼层算完那一次反过来要删掉记录、清空游标。
 */
describe('逐块提交：单块工作项与收尾文本', () => {
  const TEXT = [
    '<VariableInsert>{"hp":100}</VariableInsert>',
    '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
    '<VariableEdit>{"hp":{"$expr":"hp-20"}}</VariableEdit>',
  ].join('\n');

  function work() {
    return {
      schemaVersion: 1,
      step: { kind: 'execute' },
      disposition: 'no-op',
      plan: {
        meta: { SelectedMks: ['mk-4'] },
        messages: [{ messageId: 4 }],
        nextConsecutiveState: { mk: 'mk-4', count: 1 },
      },
      payload: { mk: 'mk-4', message_id: 4, is_user: false, actions: {}, consecutiveProcessingCount: 1 },
      failure: null,
    } as never;
  }

  function state(overrides: Record<string, unknown> = {}) {
    return {
      messageId: 4,
      mk: 'mk-4',
      blockIndex: 2,
      done: false,
      stat: { hp: 70 },
      statFunc: {},
      baseStat: { hp: 100 },
      baseStatFunc: {},
      consecutive: { mk: null, count: 0 },
      executedBlockIndex: 1,
      drawOffset: 3,
      route: 'none' as const,
      handoff: null,
      content: TEXT,
      meta: { SelectedMks: [] },
      work: {},
      ...overrides,
    } as never;
  }

  it('提交该块之后的状态，并把该块包成带 draws 的已应用记录', () => {
    const built = buildPerBlockCommitWork({ work: work(), state: state() });

    expect(built?.disposition).toBe('commit');
    expect(built?.plan?.stat).toEqual({ hp: 70 });
    const update = built?.plan?.messageUpdates?.[0];
    const text = update?.content.kind === 'text' ? update.content.text : '';
    expect(text).toContain(
      '<era_block mk="mk-4" applied="1" draws="3"><VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit></era_block>',
    );
    // 游标记「已提交块的下标（含）」，恢复时从它 +1 继续。
    expect(built?.syncCursor).toMatchObject({ messageId: 4, mk: 'mk-4', blockIndex: 1 });
  });

  it('交接迭代没有执行块时不提交任何东西', () => {
    const built = buildPerBlockCommitWork({
      work: work(),
      state: state({ executedBlockIndex: null, route: 'invoke' }),
    });

    expect(built).toBe(null);
  });

  it('楼层算完时的收尾文本删掉全部记录', () => {
    const withRecords = [
      '<era_block mk="mk-4" applied="1" draws="1"><VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit></era_block>',
      '<VariableEdit>{"hp":{"$expr":"hp-20"}}</VariableEdit>',
    ].join('\n');

    expect(buildCompletedFloorContent(state({ content: withRecords, done: true }))).toBe(
      [
        '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
        '<VariableEdit>{"hp":{"$expr":"hp-20"}}</VariableEdit>',
      ].join('\n'),
    );
  });
});
