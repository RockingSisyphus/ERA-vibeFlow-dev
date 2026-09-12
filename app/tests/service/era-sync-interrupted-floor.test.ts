/**
 * 被中断楼层（带逐块提交凭据）在引擎侧的三处接线。
 *
 * 逐块提交后 sidecar 的 stat 可能停在「楼层算到一半」的位置。消息里的 `<era_block applied="1">`
 * 记录是最早的持久凭据，引擎必须据此：①把它纳入重算窗口；②重放时跳过已提交的指令前缀；
 * ③把该楼层的 EditLogs 追加而不是覆盖（回退依赖日志完整）。
 */

import { describe, expect, it } from 'vitest';

import {
  applyMessageCommands,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 产品测试直接验证 VibeFlow 纯领域源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/base_lib/domain/crud_engine';
import {
  findSyncDivergence,
  planEraSync,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 产品测试直接验证 VibeFlow 纯领域源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/base_lib/domain/sync_engine';
import {
  wrapBlockAsAppliedRecord,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 产品测试直接验证 VibeFlow 纯领域源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/base_lib/domain/message_function_calls';
import type { EraMkMessageV1 } from '../../../javascript_project/service/base_lib/domain/mk_engine';

const BLOCKS = [
  '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
  '<VariableEdit>{"hp":{"$expr":"hp-30"}}</VariableEdit>',
  '<VariableEdit>{"hp":{"$expr":"hp-10"}}</VariableEdit>',
];

function mkBlock(mk: string): string {
  return `<era_data>{"era-message-key"="${mk}","era-message-type"="assistant"}</era_data>`;
}

function message(messageId: number, mk: string, body: string): EraMkMessageV1 {
  return {
    messageId,
    role: 'assistant',
    content: { kind: 'text', text: `${body}\n${mkBlock(mk)}` },
  } as EraMkMessageV1;
}

/** 把第 index 个块包成「已应用」记录。 */
function interrupted(text: string, index: number, mk: string): string {
  const start = text.indexOf(BLOCKS[index]);
  return wrapBlockAsAppliedRecord({
    content: text,
    start,
    end: start + BLOCKS[index].length,
    mk,
  });
}

/** 单独应用一部分块，得到「这些块之后」的已提交世界与它的编辑日志。 */
function commitPrefix(blocks: readonly string[], initialStat: unknown) {
  const applied = applyMessageCommands({
    content: blocks.join('\n'),
    messageId: 1,
    initialStat,
    meta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
    // 省略随机源时 `random()` 没有游标可用，会静默不生效——随机用例必须带上它。
    randomSourceKey: 'mk-1',
    commandRange: { fromIndex: 0, toIndex: blocks.length },
  });
  return { stat: applied.finalStat, editLog: applied.editLog };
}

describe('被中断楼层：重算窗口、重放前缀与日志累积', () => {
  it('存在已应用记录的最早楼层必须被纳入重算（即使 SelectedMks 没有分歧）', () => {
    const plain = message(0, 'mk-a', '<VariableInsert>{"gold":1}</VariableInsert>');

    // 常规判定：mk 链完全一致且长度相同 → no-divergence → 只重算最后一条。
    const noRecords = findSyncDivergence([plain, message(1, 'mk-b', BLOCKS.join('\n'))], ['mk-a', 'mk-b'], {});
    expect(noRecords).toMatchObject({ type: 'FULL_RECALC', recalcId: 1 });

    // 记录落在更早的楼层时：必须从它开始重算，否则它永远算不完。
    const earlierRecord = findSyncDivergence(
      [message(0, 'mk-a', interrupted(BLOCKS.join('\n'), 0, 'mk-a')), message(1, 'mk-b', BLOCKS.join('\n'))],
      ['mk-a', 'mk-b'],
      {},
    );
    expect(earlierRecord).toMatchObject({ type: 'FULL_RECALC', recalcId: 0 });
  });

  it('FAST_SYNC 结论也会因为记录楼层存在而被收紧为整楼重算', () => {
    const divergence = findSyncDivergence(
      [message(0, 'mk-a', interrupted(BLOCKS.join('\n'), 0, 'mk-a'))],
      ['mk-a', 'mk-old'],
      { EditLogs: { 'mk-old': [] } },
    );

    expect(divergence.type).toBe('FULL_RECALC');
  });

  it('重放跳过已提交前缀，EditLogs 追加而不是覆盖', () => {
    const committed = commitPrefix(BLOCKS.slice(0, 1), { hp: 100 });
    expect(committed.stat).toEqual({ hp: 90 });

    const floor = message(1, 'mk-1', interrupted(BLOCKS.join('\n'), 0, 'mk-1'));
    const plan = planEraSync({
      messages: [floor],
      stat: committed.stat,
      statFunc: {},
      meta: {
        SelectedMks: [],
        EditLogs: { 'mk-1': committed.editLog },
        FunctionEditLogs: { 'mk-1': [] },
      },
      reason: 'manual',
      processingMk: 'mk-1',
      consecutiveState: null,
    });

    if (plan.status === 'failed') throw new Error(plan.error.message);
    // 已提交的第一块不再重放：只算 -30、-10（重放会得到 40）。
    expect(plan.stat).toEqual({ hp: 50 });
    // 日志必须是「已提交块 + 剩余块」的完整序列，否则回退会漏掉第一块。
    expect((plan.meta.EditLogs as Record<string, unknown>)['mk-1']).toHaveLength(3);
  });

  it('随机抽取的续做必须接着已提交块继续（否则两条路径随机值不同）', () => {
    const randomBlocks = [
      '<VariableEdit>{"roll":{"$expr":"random()"}}</VariableEdit>',
      '<VariableEdit>{"roll2":{"$expr":"random()"}}</VariableEdit>',
    ];
    // 两条路径都必须真的抽到值：`VariableEdit` 只改不增，所以先给两个键初值。
    const initial = { roll: 0, roll2: 0 };
    // 整楼重放：一次调用内连续抽两次。
    const full = commitPrefix(randomBlocks, initial);
    // 续做：第一块已提交（记录里带该块之后的 draws=1），第二块单独抽。
    const first = commitPrefix([randomBlocks[0]], initial);
    const text = [
      `<era_block mk="mk-1" applied="1" draws="1">${randomBlocks[0]}</era_block>`,
      randomBlocks[1],
      mkBlock('mk-1'),
    ].join('\n');
    const plan = planEraSync({
      messages: [message(1, 'mk-1', text)],
      stat: first.stat,
      statFunc: {},
      meta: { SelectedMks: ['mk-1'], EditLogs: { 'mk-1': first.editLog }, FunctionEditLogs: { 'mk-1': [] } },
      reason: 'manual',
      processingMk: 'mk-1',
      consecutiveState: null,
    });

    if (plan.status === 'failed') throw new Error(plan.error.message);
    // 只改不增：确认两条路径都真的抽了，而不是「因为指令没生效所以相等」。
    expect(first.stat).not.toEqual(initial);
    expect(full.stat).not.toEqual(first.stat);
    expect(plan.stat).toEqual(full.stat);
  });

  it('没有记录时行为不变：整楼从起点重放', () => {
    const plan = planEraSync({
      messages: [message(1, 'mk-1', BLOCKS.join('\n'))],
      stat: { hp: 100 },
      statFunc: {},
      meta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
      reason: 'manual',
      processingMk: 'mk-1',
      consecutiveState: null,
    });

    if (plan.status === 'failed') throw new Error(plan.error.message);
    expect(plan.stat).toEqual({ hp: 50 });
    expect((plan.meta.EditLogs as Record<string, unknown>)['mk-1']).toHaveLength(3);
  });
});
