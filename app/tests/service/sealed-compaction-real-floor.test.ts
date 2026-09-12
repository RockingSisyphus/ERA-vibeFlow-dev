import { describe, expect, it } from 'vitest';

import {
  applySealedCommandCompaction,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 产品测试直接验证 VibeFlow 纯编排源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/base_lib/command_compaction';
import {
  planEraSync,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 产品测试直接验证 VibeFlow 纯领域源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/base_lib/domain/sync_engine';

function mkBlock(mk: string): string {
  return `<era_data>{"era-message-key"="${mk}","era-message-type"="assistant"}</era_data>`;
}

function message(messageId: number, mk: string, body: string) {
  return {
    messageId,
    role: 'assistant',
    content: { kind: 'text' as const, text: `${body}\n${mkBlock(mk)}` },
  };
}

// 真机证据逐字复制：`st-run-20260911T18572962-bea9ca9f83c3` 的 `COMBINED-AUTHOR-001`
// 第 2 楼（`author-initial` 观测到的原文）。该楼层在 `ERA.sync {mode:"full"}` 之后被
// 封存压缩阶段用 `renderTag` 美化成多行 `<VariableEdit>`，把「这些话的文本不得变化」
// 的绑定断言全部打掉（`COMBINED-AUTHOR-001/002` 6+8 条、`COMBINED-HISTORY-002/003` 2+1 条）。
const REAL_BODY =
  '<VariableEdit>{"era_demo":{"player":{"hp":13}}}</VariableEdit><FunctionInsert>{"singleFloorHistory":{"params":["x"],"expr":"x+1"}}</FunctionInsert>探索记录 1';
const REAL_FLOOR = `${REAL_BODY}\n${mkBlock('era_mk_1789165770160_c1pzo0d9')}`;

function rawPlan() {
  return planEraSync({
    messages: [
      message(0, 'era_mk_1789165770160_c1pzo0d9', REAL_BODY),
      message(1, 'era_mk_latest', '探索记录 2'),
    ],
    stat: { era_demo: { player: { hp: 12 } } },
    statFunc: {},
    meta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
    reason: 'manual',
    forceFullRebuild: true,
    processingMk: 'era_mk_latest',
    consecutiveState: null,
  });
}

describe('封存压缩：真机 COMBINED-AUTHOR 楼层的整段文本不得被重排', () => {
  it('full 同步后第 2 楼的文本逐字节不变，且可重放', () => {
    const plan = applySealedCommandCompaction(rawPlan());
    expect(plan.status).toBe('recalculated');

    // 1) 聊天文本逐字节不变——这是真机绑定断言的判据。
    const floor = plan.messages[0];
    const text = floor?.content.kind === 'text' ? floor.content.text : undefined;
    expect(text).toBe(REAL_FLOOR);
    // 2) 也就不该产生任何针对该楼层的写回工作项。
    const updates = plan.messageUpdates as readonly { messageId?: number }[];
    expect(updates.filter((item) => item.messageId === 0)).toHaveLength(0);

    // 3) 状态仍按原文结算，并且用压缩后的 messages 重放得到同一状态。
    expect(plan.stat).toEqual({ era_demo: { player: { hp: 13 } } });
    expect(plan.statFunc).toEqual({
      singleFloorHistory: { params: ['x'], expr: 'x+1' },
    });
    const replay = planEraSync({
      messages: plan.messages,
      stat: { era_demo: { player: { hp: 12 } } },
      statFunc: {},
      meta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
      reason: 'manual',
      forceFullRebuild: true,
      processingMk: 'era_mk_latest',
      consecutiveState: null,
    });
    expect(replay.stat).toEqual(plan.stat);
    expect(replay.statFunc).toEqual(plan.statFunc);
  });
});
