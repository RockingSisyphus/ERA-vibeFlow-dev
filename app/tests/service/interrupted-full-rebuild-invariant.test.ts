import { describe, expect, it } from 'vitest';

import { applyMessageCommands } from '../../../javascript_project/service/base_lib/domain/crud_engine';
import { planEraSync } from '../../../javascript_project/service/base_lib/domain/sync_engine';

/**
 * 真机 SIDECAR-BIND-014 的形态：楼层文本留着「已应用」记录（块级提交写到一半），
 * 此刻希望做一次**从空世界开始的全量重建**（rollback to null、recalc [0,1,2,3]）。
 *
 * 不变量：从空世界全量重建的结果，必须等于「把记录去壳后从空世界重放一遍」的结果。
 */
function message(text: string, messageId: number, mk: string) {
  return {
    schemaVersion: 1,
    messageId,
    role: 'assistant',
    swipeIndex: 0,
    content: {
      kind: 'text' as const,
      text: `${text}\n<era_data>{"era-message-key"="${mk}","era-message-type"="assistant"}</era_data>`,
    },
    extra: {},
  } as never;
}

describe('被中断楼层：从空世界全量重建的不变量', () => {
  // 已知未修（第 112 轮定位）：真机 SIDECAR-BIND-014 的 `history-changed` 全量重建
  // （recalc [0,1,2,3]、rollback to null）把 `score` 弄成 0，而定向重放（recalc [3]）得到 8。
  // 用 it.fails 锁定这条不变量，修好后会变成「意外通过」以提醒翻回 it。
  it.fails('已应用记录只是续做凭据，不该改变从空世界重放的终值', () => {
    const command = '<VariableInsert>{"repair_player":{"hp":20,"score":0}}</VariableInsert>';
    const scoreEdit = '<VariableEdit>{"repair_player":{"score":8}}</VariableEdit>';
    const plain = `${command}${scoreEdit}`;
    // 前一个块已落盘为「已应用」记录，后一个块还没提交（这正是被中断的样子）。
    const wrapped =
      `<era_block mk="mk-1" applied="1">${command}</era_block>` + scoreEdit;

    const fromScratch = applyMessageCommands({
      content: plain,
      messageId: 1,
      initialStat: {},
      meta: {},
      randomSourceKey: 'mk-1',
    }).finalStat;

    const plan = planEraSync({
      messages: [message(wrapped, 1, 'mk-1')],
      stat: {},
      statFunc: {},
      meta: { SelectedMks: ['mk-1'], EditLogs: {}, FunctionEditLogs: {} },
      reason: 'history-changed',
      forceFullRebuild: true,
      // 真机那条路径就是「定向到第 0 楼的全量重建」（recalc [0,1,2,3]）。
      targetMessageId: 0,
      processingMk: 'mk-1',
      consecutiveState: { mk: null, count: 0 },
    } as never);

    expect(plan.status).not.toBe('failed');
    expect((plan as { stat: unknown }).stat).toEqual(fromScratch);
  });
});
