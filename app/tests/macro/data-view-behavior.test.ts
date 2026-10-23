import { describe, expect, it } from 'vitest';
import { removeMetaFields, transformEraData } from '@era/vibeflow-floor-snapshot';
import { runEraMacroWorkflow } from '../../src/ERA变量框架/macro/vibeflow-adapter';

describe('宏与公开数据视图的可观察结果', () => {
  it('反转义嵌套键值、过滤元字段，特殊键仍是数据且输入不变', () => {
    const stored = JSON.parse(
      '{"a__DOT__b":[{"name":"x__DQUOTE__y","$hidden":1}],"__proto__":{"value":2},"constructor":"own","$root":3}',
    );
    const before = JSON.stringify(stored);
    const expected = { ...JSON.parse('{"__proto__":{"value":2}}'), 'a.b': [{ name: 'x"y' }], constructor: 'own' };
    const publicView = removeMetaFields(transformEraData(stored, 'unescape'));
    const macroView = JSON.parse(runEraMacroWorkflow('{{ERA:$ALLDATA}}', { kind: 'present', value: stored }));
    expect(publicView).toEqual(expected);
    expect(macroView).toEqual(expected);
    expect(Object.hasOwn(publicView, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(publicView)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).value).toBeUndefined();
    expect(JSON.stringify(stored)).toBe(before);
  });

  it('缺失状态保留文本，显式视图不再次反转义或过滤', () => {
    const text = '{{ERA:name}}';
    expect(runEraMacroWorkflow(text, { kind: 'missing' })).toBe(text);
    expect(
      runEraMacroWorkflow(text, { kind: 'view', mode: 'raw', statWithMeta: {}, statWithoutMeta: { name: '__DOT__' } }),
    ).toBe('__DOT__');
    expect(runEraMacroWorkflow(text, { kind: 'projection-only' })).toBe(text);
    expect(runEraMacroWorkflow(text, { kind: 'present', value: {} })).toBe('');
  });

  it('公开转换保留数组缺项、null与键冲突的既有覆盖顺序', () => {
    const input = new Array(3);
    input[0] = { $hidden: 1, value: null };
    input[2] = 'x__SQUOTE__y';
    const output = removeMetaFields(transformEraData(input, 'unescape'));
    const expected = new Array(3);
    expected[0] = { value: null };
    expected[2] = "x'y";
    expect(output).toEqual(expected);
    expect(1 in output).toBe(false);
    expect(transformEraData({ a__DOT__b: 1, 'a.b': 2 }, 'unescape')).toEqual({ 'a.b': 2 });
    expect(transformEraData(transformEraData({ 'a.b': "x'y" }, 'escape'), 'unescape')).toEqual({ 'a.b': "x'y" });
  });
});
