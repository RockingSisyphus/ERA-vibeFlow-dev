import { describe, expect, it } from 'vitest';

import {
  functionProtection,
  planFunctionLibraryDiff,
  planVariableDiff,
  planVariableExpression,
  variableProtections,
  wrapFunctionProtection,
  wrapVariableProtection,
} from '../../src/ERA变量框架/ui/utils/data-workbench';

describe('变量与函数工作台纯操作规划', () => {
  it('把对象子树的新增、修改和删除规划为有序的真实 ERA 操作', () => {
    const plan = planVariableDiff(
      { hp: 10, title: '旧', nested: { keep: true }, items: [1, 2] },
      { hp: 12, nested: { keep: true, added: '新' }, items: [1, 3] },
      ['player'],
    );

    expect(plan.operations).toEqual([
      { edit: { player: { hp: 12 } } },
      { delete: { player: { title: {} } } },
      { insert: { player: { nested: { added: '新' } } } },
      { edit: { player: { items: [1, 3] } } },
    ]);
  });

  it('对象与标量互换时严格使用 delete 后 insert', () => {
    expect(planVariableDiff({ hp: 10 }, 20, ['player']).operations).toEqual([
      { delete: { player: {} } },
      { insert: { player: 20 } },
    ]);
    expect(planVariableDiff(20, { hp: 10 }, ['player']).operations).toEqual([
      { delete: { player: {} } },
      { insert: { player: { hp: 10 } } },
    ]);
  });

  it('维护 $template 时使用有序 delete 后 insert，$meta 仍正常编辑', () => {
    expect(
      planVariableDiff(
        { node: { $template: 'old', $meta: { note: 'old' } } },
        { node: { $template: 'new', $meta: { note: 'new' } } },
      ).operations,
    ).toEqual([
      { delete: { node: { $template: {} } } },
      { insert: { node: { $template: 'new' } } },
      { edit: { node: { $meta: { note: 'new' } } } },
    ]);
  });

  it('保留中文和特殊字符键并生成 $expr 操作', () => {
    expect(planVariableExpression(['角色.状态', '生命 值'], '@角色.状态.生命值 + 2').operations).toEqual([
      { edit: { '角色.状态': { '生命 值': { $expr: '@角色.状态.生命值 + 2' } } } },
    ]);
  });

  it('发现目标与祖先保护并生成临时解锁、修改、恢复序列', () => {
    const root = {
      player: {
        $meta: { updatable: false },
        hp: { $meta: { updatable: false }, value: 10 },
      },
    };
    const protections = variableProtections(root, ['player', 'hp'], 'edit');
    expect(protections.map(item => [item.path.join('.'), item.field])).toEqual([
      ['player', 'updatable'],
      ['player.hp', 'updatable'],
    ]);
    expect(wrapVariableProtection([{ edit: { player: { hp: 11 } } }], protections, 'temporary')).toEqual([
      { edit: { player: { $meta: { updatable: true } } } },
      { edit: { player: { hp: { $meta: { updatable: true } } } } },
      { edit: { player: { hp: 11 } } },
      { edit: { player: { hp: { $meta: { updatable: false } } } } },
      { edit: { player: { $meta: { updatable: false } } } },
    ]);
  });

  it('函数库批量差异按 Insert、Edit、Delete 分组且不改写原对象', () => {
    const original = {
      f: { params: ['x'], expr: 'x+1' },
      gone: { params: ['x'], expr: 'x' },
    };
    const draft = {
      f: { params: ['x'], expr: 'x+2' },
      g: { params: ['x', 'y'], expr: 'f(x)+y' },
    };
    expect(planFunctionLibraryDiff(original, draft).operations).toEqual([
      { functionInsert: { g: { params: ['x', 'y'], expr: 'f(x)+y' } } },
      { functionEdit: { f: { params: ['x'], expr: 'x+2' } } },
      { functionDelete: { gone: {} } },
    ]);
    expect(original.f.expr).toBe('x+1');
  });

  it('函数保护支持临时解锁并恢复', () => {
    const protections = functionProtection({ params: ['x'], expr: 'x+1', $meta: { updatable: false } }, 'edit');
    expect(
      wrapFunctionProtection('f', [{ functionEdit: { f: { params: ['x'], expr: 'x+2' } } }], protections, 'temporary'),
    ).toEqual([
      { functionEdit: { f: { $meta: { updatable: true } } } },
      { functionEdit: { f: { params: ['x'], expr: 'x+2' } } },
      { functionEdit: { f: { $meta: { updatable: false } } } },
    ]);
  });
});
