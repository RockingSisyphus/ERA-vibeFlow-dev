/**
 * 单块提交工作项构造（切片 1b 的纯构造部分）。
 *
 * 锁定语义要求每个操作块执行完就提交一次状态；既有提交链的 stat/statFunc/meta 全部取自
 * plan，所以单块提交靠「只含该块的 plan」表达，而不是新增提交通道。
 */

import { describe, expect, it } from 'vitest';

import { buildBlockCommitWork } from '../../../javascript_project/service/base_lib/block_step_state';

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
