import { describe, expect, it } from 'vitest';

import {
  applyMessageCommands,
  parseMessageCommands,
  resolveRelativeEdit,
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
  applySealedCommandCompaction,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment -- 产品测试直接验证 VibeFlow 纯编排源码。
  // @ts-ignore TypeScript 会对 app rootDir 外的 VibeFlow 源码报告 TS6059。
} from '../../../javascript_project/service/base_lib/command_compaction';

function tag(name: string, value: unknown): string {
  return `<${name}>${JSON.stringify(value)}</${name}>`;
}

function edit(value: unknown): string {
  return tag('VariableEdit', value);
}

function apply(content: string, initialStat: unknown, initialStatFunc: Record<string, unknown> = {}) {
  return applyMessageCommands({
    content,
    messageId: 1,
    initialStat,
    initialStatFunc,
    meta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
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

describe('ERA $expr 与函数指令', () => {
  it('按原文顺序执行 $expr，并记录具体 old/new', () => {
    const result = apply(
      [
        edit({ player: { hp: { $expr: 'player.hp + 2' } } }),
        edit({ player: { hp: { $expr: 'player.hp * 1.25 - 1.5' } } }),
      ].join('\n'),
      { player: { hp: 10 } },
    );

    expect(result.finalStat).toEqual({ player: { hp: 13.5 } });
    expect(result.editLog).toEqual([
      { op: 'update', path: 'player.hp', value_old: 10, value_new: 12 },
      { op: 'update', path: 'player.hp', value_old: 12, value_new: 13.5 },
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('动态变量与 @变量快照遵循同一消息层的开始状态', () => {
    const result = apply(
      [edit({ a: { $expr: '@a + 1' } }), edit({ b: { $expr: 'a * 2' } }), edit({ a: { $expr: 'a + 1' } })].join('\n'),
      { a: 1, b: 0 },
    );
    expect(result.finalStat).toEqual({ a: 3, b: 4 });
  });

  it('保留普通 JSON 赋值，旧运算符全部 fail-closed', () => {
    const result = apply(
      edit({
        direct: 2,
        text: '+=2',
        legacy: { $inc: 2 },
        sibling: { $expr: 'sibling + 4' },
        malformed: { $expr: 'malformed + 1', note: true },
      }),
      { direct: 1, text: 'old', legacy: 3, sibling: 1, malformed: 2 },
    );
    expect(result.finalStat).toEqual({ direct: 2, text: '+=2', legacy: 3, sibling: 5, malformed: 2 });
    expect(result.diagnostics.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: 'ERA_EDIT_OPERATOR_INVALID', path: 'legacy' },
      { code: 'ERA_EDIT_OPERATOR_INVALID', path: 'malformed' },
    ]);
    expect(resolveRelativeEdit({ $set: 1 }, 1, 'a')).toMatchObject({
      kind: 'invalid',
      diagnostic: { code: 'ERA_EDIT_OPERATOR_INVALID', path: 'a' },
    });
  });

  it('Function Insert/Edit/Delete 与变量命令按原文交错，并支持 @函数快照闭包', () => {
    const content = [
      tag('FunctionEdit', { f: { params: ['x'], expr: 'g(x) + 1' } }),
      tag('FunctionEdit', { g: { params: ['x'], expr: 'x * 3' } }),
      edit({ snapshot: { $expr: '@f(a)' } }),
      edit({ current: { $expr: 'f(a)' } }),
      tag('FunctionDelete', { f: {} }),
    ].join('\n');
    const result = apply(
      content,
      { a: 2, snapshot: 0, current: 0 },
      {
        f: { params: ['x'], expr: 'g(x) + 1' },
        g: { params: ['x'], expr: 'x * 2' },
      },
    );

    expect(result.finalStat).toEqual({ a: 2, snapshot: 5, current: 7 });
    expect(result.finalStatFunc).toEqual({ g: { params: ['x'], expr: 'x * 3' } });
    expect(result.functionEditLog).toEqual([
      {
        op: 'update',
        name: 'f',
        value_old: { params: ['x'], expr: 'g(x) + 1' },
        value_new: { params: ['x'], expr: 'g(x) + 1' },
      },
      {
        op: 'update',
        name: 'g',
        value_old: { params: ['x'], expr: 'x * 2' },
        value_new: { params: ['x'], expr: 'x * 3' },
      },
      { op: 'delete', name: 'f', value_old: { params: ['x'], expr: 'g(x) + 1' } },
    ]);
  });

  it('函数库变更是原子的：递归、缺失和错误删除均不污染当前库', () => {
    const result = apply(
      [
        tag('FunctionInsert', { f: { params: ['x'], expr: 'f(x)' } }),
        tag('FunctionEdit', { absent: { params: ['x'], expr: 'x' } }),
        tag('FunctionDelete', { g: { nope: true } }),
        edit({ result: { $expr: 'g(a)' } }),
      ].join('\n'),
      { a: 2, result: 0 },
      {
        g: { params: ['x'], expr: 'x + 1' },
      },
    );
    expect(result.finalStat).toEqual({ a: 2, result: 3 });
    expect(result.finalStatFunc).toEqual({ g: { params: ['x'], expr: 'x + 1' } });
    expect(result.diagnostics.map(item => item.code)).toEqual([
      'ERA_EXPR_FUNCTION_RECURSION',
      'ERA_FUNCTION_NOT_FOUND',
      'ERA_FUNCTION_DELETE_INVALID',
    ]);
  });

  it('函数 $meta.updatable 与变量一致：锁住编辑，但同次显式解锁可以更新定义', () => {
    const initial = {
      f: {
        params: ['x'],
        expr: 'x + 1',
        $meta: { updatable: false, note: 'locked' },
      },
    };
    const result = apply(
      [
        tag('FunctionEdit', { f: { params: ['x'], expr: 'x + 2' } }),
        tag('FunctionEdit', {
          f: {
            params: ['x'],
            expr: 'x * 3',
            $meta: { updatable: true },
          },
        }),
      ].join('\n'),
      {},
      initial,
    );

    expect(result.finalStatFunc).toEqual({
      f: {
        params: ['x'],
        expr: 'x * 3',
        $meta: { updatable: true, note: 'locked' },
      },
    });
    expect(result.functionEditLog).toEqual([
      {
        op: 'update',
        name: 'f',
        value_old: initial.f,
        value_new: {
          params: ['x'],
          expr: 'x * 3',
          $meta: { updatable: true, note: 'locked' },
        },
      },
    ]);
  });

  it('函数 $meta.necessary 可维护后删除，且元数据编辑不会改写函数数学定义', () => {
    const initial = {
      f: {
        params: ['x'],
        expr: 'x + 1',
        $meta: { necessary: 'all', note: 'keep until unlocked' },
      },
    };
    const result = apply(
      [
        tag('FunctionEdit', { f: { $meta: { note: 'still protected' } } }),
        tag('FunctionDelete', { f: {} }),
        tag('FunctionDelete', { f: { $meta: { necessary: {} } } }),
        tag('FunctionDelete', { f: {} }),
      ].join('\n'),
      {},
      initial,
    );

    expect(result.finalStatFunc).toEqual({});
    expect(result.functionEditLog).toEqual([
      {
        op: 'update',
        name: 'f',
        value_old: initial.f,
        value_new: {
          params: ['x'],
          expr: 'x + 1',
          $meta: { necessary: 'all', note: 'still protected' },
        },
      },
      {
        op: 'update',
        name: 'f',
        value_old: {
          params: ['x'],
          expr: 'x + 1',
          $meta: { necessary: 'all', note: 'still protected' },
        },
        value_new: {
          params: ['x'],
          expr: 'x + 1',
          $meta: { note: 'still protected' },
        },
      },
      {
        op: 'delete',
        name: 'f',
        value_old: {
          params: ['x'],
          expr: 'x + 1',
          $meta: { note: 'still protected' },
        },
      },
    ]);
  });

  it('函数不支持变量树专属元数据，并对整个标签 fail-closed', () => {
    const result = apply(
      tag('FunctionInsert', {
        valid: { params: ['x'], expr: 'x + 1' },
        invalid: { params: ['x'], expr: 'x', $meta: { unInsertAble: 'all' } },
      }),
      {},
    );
    expect(result.finalStatFunc).toEqual({});
    expect(result.functionEditLog).toEqual([]);
    expect(result.diagnostics).toMatchObject([{ code: 'ERA_FUNCTION_META_UNSUPPORTED', path: 'invalid' }]);
  });

  it('同一 FunctionInsert 支持前向声明与嵌套调用，并拒绝整体递归库', () => {
    const accepted = apply(
      `${tag('FunctionInsert', {
        f: { params: ['x'], expr: 'g(x) + 1' },
        g: { params: ['x'], expr: 'x * 2' },
      })}${edit({ result: { $expr: 'f(value)' } })}`,
      { value: 3, result: 0 },
    );
    expect(accepted.finalStat).toEqual({ value: 3, result: 7 });
    expect(accepted.finalStatFunc).toMatchObject({ f: expect.any(Object), g: expect.any(Object) });
    const rejected = apply(
      tag('FunctionInsert', {
        f: { params: ['x'], expr: 'g(x)' },
        g: { params: ['x'], expr: 'f(x)' },
      }),
      {},
      {},
    );
    expect(rejected.finalStatFunc).toEqual({});
    expect(rejected.diagnostics.map(item => item.code)).toEqual(['ERA_EXPR_FUNCTION_RECURSION']);
  });

  it('完整同步会重放函数库和变量，而不是在第二次 full rebuild 中重复累计', () => {
    const messages = [
      message(0, 'mk-functions', tag('FunctionInsert', { f: { params: ['x'], expr: 'x + 5' } })),
      message(1, 'mk-expression', edit({ hp: { $expr: 'f(hp)' } })),
    ];
    const first = planEraSync({
      messages,
      stat: { hp: 10 },
      statFunc: {},
      meta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
      reason: 'manual',
      forceFullRebuild: true,
      processingMk: 'mk-expression',
      consecutiveState: null,
    });
    expect(first.stat).toEqual({ hp: 15 });
    expect(first.statFunc).toEqual({ f: { params: ['x'], expr: 'x + 5' } });
    const replay = planEraSync({
      messages,
      stat: first.stat,
      statFunc: first.statFunc,
      meta: first.meta,
      reason: 'manual',
      forceFullRebuild: true,
      processingMk: 'mk-expression',
      consecutiveState: first.nextConsecutiveState,
    });
    expect(replay.stat).toEqual({ hp: 15 });
    expect(replay.statFunc).toEqual(first.statFunc);
  });

  it('仅封存的 AI 楼层会压缩为从 @快照可重放的最小命令', () => {
    const messages = [
      message(
        0,
        'mk-sealed',
        [
          edit({ a: { $expr: 'a + 1' } }),
          edit({ a: { $expr: 'a + 2' } }),
          tag('FunctionInsert', { f: { params: ['x'], expr: 'x + 3' } }),
        ].join('\n'),
      ),
      message(1, 'mk-latest', '最新 AI 楼层保持原样。'),
    ];
    const rawPlan = planEraSync({
      messages,
      stat: { a: 1 },
      statFunc: {},
      meta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
      reason: 'manual',
      forceFullRebuild: true,
      processingMk: 'mk-latest',
      consecutiveState: null,
    });
    const plan = applySealedCommandCompaction(rawPlan);
    expect(plan.status).toBe('recalculated');
    expect(plan.stat).toEqual({ a: 4 });
    expect(plan.statFunc).toEqual({ f: { params: ['x'], expr: 'x + 3' } });
    expect(plan.messageUpdates).toHaveLength(1);
    const compact = (plan.messageUpdates[0] as { content: { text: string } }).content.text;
    expect(compact).toContain('"$expr":"@a + 3"');
    expect(compact).toContain('<FunctionInsert>');
    expect(compact).not.toContain('a + 1');
    expect((plan.meta.CommandCompaction as Record<string, unknown>)['mk-sealed']).toMatchObject({ version: 1 });
    const replay = planEraSync({
      messages: plan.messages,
      stat: { a: 1 },
      statFunc: {},
      meta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
      reason: 'manual',
      forceFullRebuild: true,
      processingMk: 'mk-latest',
      consecutiveState: null,
    });
    expect(replay.stat).toEqual(plan.stat);
    expect(replay.statFunc).toEqual(plan.statFunc);
  });

  it('追加新的 AI 楼层时会重算最早未压缩的封存指令楼层', () => {
    const messages = [
      message(0, 'mk-sealed', edit({ a: { $expr: 'a + 1' } })),
      message(1, 'mk-latest', '新的 AI 楼层使前一层封存。'),
    ];
    expect(
      findSyncDivergence(messages, ['mk-sealed'], {
        SelectedMks: ['mk-sealed'],
        EditLogs: { 'mk-sealed': [{ op: 'update', path: 'a', value_old: 1, value_new: 2 }] },
        FunctionEditLogs: {},
        CommandCompaction: {},
      }),
    ).toEqual({ type: 'FULL_RECALC', recalcId: 0, cause: 'divergence' });
    expect(
      findSyncDivergence(messages, ['mk-sealed'], {
        SelectedMks: ['mk-sealed'],
        EditLogs: { 'mk-sealed': [{ op: 'update', path: 'a', value_old: 1, value_new: 2 }] },
        FunctionEditLogs: {},
        CommandCompaction: {
          'mk-sealed': {
            version: 1,
            mk: 'mk-sealed',
            contentHash: 'fnv1a-not-the-current-content',
            status: 'compacted',
          },
        },
      }),
    ).toEqual({ type: 'FULL_RECALC', recalcId: 0, cause: 'divergence' });
  });

  it('压缩后的中间楼层在更早楼层编辑后仍按 @快照重放', () => {
    const original = [
      message(0, 'mk-base', edit({ a: { $expr: 'a + 2' } })),
      message(
        1,
        'mk-sealed',
        [edit({ a: { $expr: 'a + 1' } }), edit({ b: { $expr: 'a * 2' } }), edit({ a: { $expr: 'a + 1' } })].join('\n'),
      ),
      message(2, 'mk-latest', '用于封存前一条 AI 消息。'),
    ];
    const compacted = applySealedCommandCompaction(
      planEraSync({
        messages: original,
        stat: { a: 10, b: 0 },
        statFunc: {},
        meta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
        reason: 'manual',
        forceFullRebuild: true,
        processingMk: 'mk-latest',
        consecutiveState: null,
      }),
    );
    const sealed = (compacted.messages[1] as { content: { text: string } }).content.text;
    expect(sealed).toContain('"b":{"$expr":"(@a + 1) * 2"}');

    const editedHistory = compacted.messages.map(item => ({ ...item }));
    editedHistory[0] = message(0, 'mk-base', edit({ a: { $expr: 'a + 5' } }));
    const replay = applySealedCommandCompaction(
      planEraSync({
        messages: editedHistory,
        stat: { a: 10, b: 0 },
        statFunc: {},
        meta: { SelectedMks: [], EditLogs: {}, FunctionEditLogs: {} },
        reason: 'edited',
        forceFullRebuild: true,
        processingMk: 'mk-latest',
        consecutiveState: null,
      }),
    );
    expect(replay.stat).toEqual({ a: 17, b: 32 });
  });

  it('解析器保留六类标签的确切出现顺序', () => {
    const types = parseMessageCommands({
      content: [
        tag('FunctionInsert', { f: { params: ['x'], expr: 'x' } }),
        edit({ a: { $expr: 'a + 1' } }),
        tag('FunctionDelete', { f: {} }),
      ].join('\n'),
    }).map(command => command.type);
    expect(types).toEqual(['function-insert', 'edit', 'function-delete']);
  });
});
