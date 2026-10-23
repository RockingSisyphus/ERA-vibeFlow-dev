/** 迁移前已通过的行为期待。只查静态数据，不保留旧实现，也不在测试时更新基线。 */
export function readExpected(reference: Record<string, unknown>): Record<string, (...args: any[]) => any> {
  function restore(value: any): any {
    if (value && typeof value === 'object') {
      if (value.__era_expected_undefined__ === true) return undefined;
      if (Array.isArray(value)) return value.map(restore);
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restore(v)]));
    }
    return value;
  }
  return new Proxy(
    {},
    {
      get:
        (_target, name) =>
        (...args: any[]) => {
          const key = JSON.stringify([name, args]);
          if (!Object.hasOwn(reference, key)) throw new Error(`缺少已冻结的行为期待：${String(name)}`);
          return restore(reference[key]);
        },
    },
  );
}
