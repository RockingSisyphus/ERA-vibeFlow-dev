import { describe, expect, it } from 'vitest';

import {
  runFunctionTrial,
  validateFunctionLibrary,
  validateVariableExpression,
} from '../../src/ERA变量框架/ui/utils/expression-trial';

describe('工作台表达式与函数试算', () => {
  const library = {
    twice: { params: ['x'], expr: 'x*2' },
    nested: { params: ['x'], expr: 'twice(x)+1' },
  };

  it('在纯内存中计算嵌套函数而不需要 Service', () => {
    expect(runFunctionTrial('nested', [4], library)).toMatchObject({ ok: true, value: 9 });
  });

  it('允许当前变量、快照变量与自定义函数混用', () => {
    expect(validateVariableExpression('nested(a) + @a', { a: 3 }, library, ['a'])).toMatchObject({
      ok: true,
      value: 10,
    });
  });

  it('报告未知变量和非有限结果', () => {
    const unknown = validateVariableExpression('missing+1', { a: 3 }, library, ['a']);
    expect(unknown.ok).toBe(false);
    expect(unknown.diagnostics.length).toBeGreaterThan(0);
    const infinite = validateVariableExpression('1/0', { a: 3 }, library, ['a']);
    expect(infinite.ok).toBe(false);
  });

  it('拒绝直接和间接递归函数库', () => {
    expect(validateFunctionLibrary({ f: { params: ['x'], expr: 'f(x)' } }).length).toBeGreaterThan(0);
    expect(
      validateFunctionLibrary({
        f: { params: ['x'], expr: 'g(x)' },
        g: { params: ['x'], expr: 'f(x)' },
      }).length,
    ).toBeGreaterThan(0);
  });

  it('报告函数参数数量错误', () => {
    const result = runFunctionTrial('twice', [1, 2], library);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});
