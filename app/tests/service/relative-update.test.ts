import { describe, expect, it } from 'vitest';

import {
  applyMessageCommands,
  resolveRelativeEdit,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 产品测试直接验证 VibeFlow 纯领域源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/base_lib/domain/crud_engine';
import {
  planEraSync,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 产品测试直接验证 VibeFlow 纯领域源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/base_lib/domain/sync_engine';
import {
  prepareApiWriteDirective,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 产品测试直接验证 VibeFlow 纯领域源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/base_lib/domain/api_write_engine';
import {
  getEraWorldbookEntries,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 产品测试直接验证 VibeFlow 纯领域源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/base_lib/domain/resource_planner';

function edit(value: unknown): string {
  return `<VariableEdit>${JSON.stringify(value)}</VariableEdit>`;
}

function insert(value: unknown): string {
  return `<VariableInsert>${JSON.stringify(value)}</VariableInsert>`;
}

function apply(content: string, initialStat: unknown) {
  return applyMessageCommands({
    content,
    messageId: 1,
    initialStat,
    meta: { SelectedMks: [], EditLogs: {} },
  });
}

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

describe('ERA JSON 相对数值更新', () => {
  it('按消息顺序执行 $inc 正负零和小数，并记录每步具体 old/new', () => {
    const result = apply(
      [
        edit({ player: { hp: { $inc: 2 } } }),
        edit({ player: { hp: { $inc: -1.5 } } }),
        edit({ player: { hp: { $inc: 0 } } }),
      ].join('\n'),
      { player: { hp: 10 } },
    );

    expect(result.finalStat).toEqual({ player: { hp: 10.5 } });
    expect(result.editLog).toEqual([
      { op: 'update', path: 'player.hp', value_old: 10, value_new: 12 },
      { op: 'update', path: 'player.hp', value_old: 12, value_new: 10.5 },
      { op: 'update', path: 'player.hp', value_old: 10.5, value_new: 10.5 },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('支持 $mul/$div 的正负零和小数，并把 -0 规范化为 0', () => {
    const result = apply(
      edit({
        positive: { $mul: 1.25 },
        negative: { $mul: -2 },
        zero: { $mul: 0 },
        quotient: { $div: 2.5 },
        negativeQuotient: { $div: -2 },
        normalizedZero: { $mul: -1 },
      }),
      { positive: 8, negative: 3, zero: 7, quotient: 10, negativeQuotient: 8, normalizedZero: 0 },
    );

    expect(result.finalStat).toEqual({
      positive: 10,
      negative: -6,
      zero: 0,
      quotient: 4,
      negativeQuotient: -4,
      normalizedZero: 0,
    });
    expect(Object.is((result.finalStat as { normalizedZero: number }).normalizedZero, -0)).toBe(false);
  });

  it('普通 JSON 继续直接赋值，四种旧字符串始终保持字面值', () => {
    const result = apply(
      edit({
        number: 2,
        text: 'next',
        enabled: false,
        nullable: null,
        object: { child: 'changed' },
        oldInc: '+=2',
        oldDec: '-=2',
        oldMul: '*=2',
        oldDiv: '/=2',
      }),
      {
        number: 1,
        text: 'old',
        enabled: true,
        nullable: 'value',
        object: { child: 'old' },
        oldInc: 1,
        oldDec: 1,
        oldMul: 1,
        oldDiv: 1,
      },
    );

    expect(result.finalStat).toMatchObject({ oldInc: '+=2', oldDec: '-=2', oldMul: '*=2', oldDiv: '/=2' });
    expect(result.diagnostics).toEqual([]);
  });

  it('无效字段逐项跳过、合法兄弟继续，并产生准确 code/path', () => {
    const result = apply(
      edit({
        good: { $inc: 2 },
        wrongOperand: { $inc: '2' },
        nonNumeric: { $mul: 2 },
        zeroDivisor: { $div: 0 },
        negativeZeroDivisor: { $div: -0 },
        overflow: { $mul: 1e308 },
        unknown: { $pow: 2 },
        multiple: { $inc: 1, $mul: 2 },
        extra: { $inc: 1, note: true },
      }),
      {
        good: 3,
        wrongOperand: 4,
        nonNumeric: '4',
        zeroDivisor: 4,
        negativeZeroDivisor: 4,
        overflow: 1e308,
        unknown: 4,
        multiple: 4,
        extra: 4,
      },
    );

    expect(result.finalStat).toMatchObject({
      good: 5,
      wrongOperand: 4,
      nonNumeric: '4',
      zeroDivisor: 4,
      negativeZeroDivisor: 4,
      overflow: 1e308,
      unknown: 4,
      multiple: 4,
      extra: 4,
    });
    expect(result.diagnostics.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: 'ERA_EDIT_OPERATOR_INVALID', path: 'wrongOperand' },
      { code: 'ERA_EDIT_TARGET_NOT_NUMERIC', path: 'nonNumeric' },
      { code: 'ERA_EDIT_DIVIDE_BY_ZERO', path: 'zeroDivisor' },
      { code: 'ERA_EDIT_DIVIDE_BY_ZERO', path: 'negativeZeroDivisor' },
      { code: 'ERA_EDIT_RESULT_NON_FINITE', path: 'overflow' },
      { code: 'ERA_EDIT_OPERATOR_INVALID', path: 'unknown' },
      { code: 'ERA_EDIT_OPERATOR_INVALID', path: 'multiple' },
      { code: 'ERA_EDIT_OPERATOR_INVALID', path: 'extra' },
    ]);
    expect(result.editLog).toEqual([{ op: 'update', path: 'good', value_old: 3, value_new: 5 }]);
  });

  it('非有限操作数 fail-closed，且不存在和受保护路径保持既有 no-op', () => {
    expect(resolveRelativeEdit({ $inc: Number.POSITIVE_INFINITY }, 1, 'value')).toMatchObject({
      kind: 'invalid',
      diagnostic: { code: 'ERA_EDIT_OPERATOR_INVALID', path: 'value' },
    });
    const result = apply(edit({ missing: { $inc: 2 }, locked: { hp: { $inc: 2 } }, open: { hp: { $inc: 2 } } }), {
      locked: { $meta: { updatable: false }, hp: 5 },
      open: { hp: 5 },
    });
    expect(result.finalStat).toEqual({
      locked: { $meta: { updatable: false }, hp: 5 },
      open: { hp: 7 },
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('updateByObject 与 updateByPath 只封装相同 VariableEdit，并由同一 CRUD 入口计算', () => {
    const objectDirective = prepareApiWriteDirective('era:updateByObject', { player: { hp: { $inc: 3 } } });
    const pathDirective = prepareApiWriteDirective('era:updateByPath', {
      path: 'player.hp',
      value: { $inc: 3 },
    });
    expect(objectDirective.blockContent).toEqual(pathDirective.blockContent);
    expect(apply(objectDirective.block, { player: { hp: 4 } }).finalStat).toEqual({ player: { hp: 7 } });
    expect(apply(pathDirective.block, { player: { hp: 4 } }).finalStat).toEqual({ player: { hp: 7 } });
  });

  it('full sync 重放不会重复累计，相同操作会从回滚后的前序状态重新计算', () => {
    const messages = [
      message(0, 'mk-base', insert({ player: { hp: 10 } })),
      message(1, 'mk-relative', edit({ player: { hp: { $inc: 5 } } })),
    ];
    const first = planEraSync({
      messages,
      stat: {},
      meta: { SelectedMks: [], EditLogs: {} },
      reason: 'manual',
      forceFullRebuild: true,
      processingMk: 'mk-relative',
      consecutiveState: null,
    });
    expect(first.stat).toEqual({ player: { hp: 15 } });
    expect((first.meta.EditLogs as Record<string, unknown>)['mk-relative']).toEqual([
      { op: 'update', path: 'player.hp', value_old: 10, value_new: 15 },
    ]);

    const replay = planEraSync({
      messages,
      stat: first.stat,
      meta: first.meta,
      reason: 'manual',
      forceFullRebuild: true,
      processingMk: 'mk-relative',
      consecutiveState: first.nextConsecutiveState,
    });
    expect(replay.stat).toEqual({ player: { hp: 15 } });
  });

  it('Swipe 分支改变前序状态后，相对运算按新分支重新求值', () => {
    const oldMessages = [
      message(0, 'mk-a', insert({ player: { hp: 10 } })),
      message(1, 'mk-relative', edit({ player: { hp: { $mul: 2 } } })),
    ];
    const oldPlan = planEraSync({
      messages: oldMessages,
      stat: {},
      meta: { SelectedMks: [], EditLogs: {} },
      reason: 'manual',
      forceFullRebuild: true,
      processingMk: 'mk-relative',
      consecutiveState: null,
    });
    expect(oldPlan.stat).toEqual({ player: { hp: 20 } });

    const newMessages = [
      message(0, 'mk-b', insert({ player: { hp: 30 } })),
      message(1, 'mk-relative', edit({ player: { hp: { $mul: 2 } } })),
    ];
    const newPlan = planEraSync({
      messages: newMessages,
      stat: oldPlan.stat,
      meta: oldPlan.meta,
      reason: 'swipe-regeneration',
      processingMk: 'mk-relative',
      consecutiveState: oldPlan.nextConsecutiveState,
    });
    expect(newPlan.stat).toEqual({ player: { hp: 60 } });
    expect((newPlan.meta.EditLogs as Record<string, unknown>)['mk-relative']).toEqual([
      { op: 'update', path: 'player.hp', value_old: 30, value_new: 60 },
    ]);
  });

  it('同步诊断补充消息索引，世界书只教授新的 JSON 格式', () => {
    const plan = planEraSync({
      messages: [message(0, 'mk-invalid', edit({ hp: { $div: 0 }, gold: { $inc: 2 } }))],
      stat: { hp: 8, gold: 1 },
      meta: { SelectedMks: [], EditLogs: {} },
      reason: 'manual',
      forceFullRebuild: true,
      processingMk: 'mk-invalid',
      consecutiveState: null,
    });
    expect(plan.stat).toEqual({ hp: 8, gold: 3 });
    expect(plan.diagnostics).toEqual([
      expect.objectContaining({ code: 'ERA_EDIT_DIVIDE_BY_ZERO', path: 'hp', messageIndex: 0 }),
    ]);

    const rule = String(getEraWorldbookEntries()[0]?.content ?? '');
    expect(rule).toContain('{"$inc": -10}');
    expect(rule).toContain('{"$mul": 1.2}');
    expect(rule).toContain('{"$div": 2}');
    expect(rule).toContain('禁止输出 `"+=2"`');
    expect(rule).toContain('"hp": { "$inc": -5 }');
  });
});
