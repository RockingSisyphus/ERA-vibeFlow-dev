import { describe, expect, it } from 'vitest';

import { planEraSync } from '../../../javascript_project/service/base_lib/sync/sync_planning';

/**
 * 真机 SIDECAR-BIND-014 的形态（探针实测）：楼层文本留着「已应用」记录，侧车里也已提交了该楼层
 * **整条** EditLog；此时做一次全量重建（recalc 从 0、rollback to null），回退会用这条日志把
 * 前缀效果一并撤掉，于是重放**不能**再跳过前缀，否则前缀效果丢失（真机表现为 `score` 丢成 0）。
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

describe('被中断楼层：回退覆盖到该楼层后不得再跳过已应用前缀', () => {
  it('前缀效果必须留在终值里（真机 score 丢失就是这里）', () => {
    const prefix =
      '<era_block mk="mk-1" applied="1"><VariableEdit>{"repair_player":{"hp":{"$expr":"repair_player.hp + 1"}}}</VariableEdit></era_block>';
    const suffix = '<VariableEdit>{"repair_player":{"score":8}}</VariableEdit>';
    const plan = planEraSync({
      messages: [message(prefix + suffix, 1, 'mk-1')],
      // 侧车里已提交的世界（含本楼层整条效果）与它的完整日志。
      stat: { repair_player: { hp: 18, score: 8 } },
      statFunc: {},
      meta: {
        SelectedMks: ['mk-1'],
        EditLogs: {
          'mk-1': [
            { op: 'update', path: 'repair_player.hp', value_old: 17, value_new: 18 },
            { op: 'update', path: 'repair_player.score', value_old: 0, value_new: 8 },
          ],
        },
        FunctionEditLogs: { 'mk-1': [] },
      },
      reason: 'history-changed',
      targetMessageId: 0,
      processingMk: 'mk-1',
      consecutiveState: { mk: null, count: 0 },
    } as never);

    if (plan.status === 'failed') throw new Error(plan.error.message);
    // 回退到 null 会把 hp 撤回 17、score 撤回 0；从指令 0 重放后 hp 必须重新 +1。
    expect(plan.stat).toEqual({ repair_player: { hp: 18, score: 8 } });
  });

  it('旧中间产物缺少日志时报告恢复问题，不猜测起点', () => {
    const prefix =
      '<era_block mk="mk-1" applied="1"><VariableEdit>{"repair_player":{"hp":{"$expr":"repair_player.hp + 1"}}}</VariableEdit></era_block>';
    const suffix = '<VariableEdit>{"repair_player":{"score":8}}</VariableEdit>';
    const plan = planEraSync({
      messages: [message(prefix + suffix, 1, 'mk-1')],
      stat: { repair_player: { hp: 18, score: 0 } },
      statFunc: {},
      // 块级中途提交不写自己的日志：回退无法撤掉前缀 ⇒ 前缀仍在基线里 ⇒ 跳过才是对的。
      meta: { SelectedMks: ['mk-1'], EditLogs: {}, FunctionEditLogs: {} },
      reason: 'history-changed',
      targetMessageId: 0,
      processingMk: 'mk-1',
      consecutiveState: { mk: null, count: 0 },
    } as never);

    expect(plan.status).toBe('failed');
    expect(plan).toMatchObject({
      error: { code: 'ERA_SYNC_PROGRESS_UNRECOVERABLE' },
      stat: { repair_player: { hp: 18, score: 0 } },
    });
  });
});
