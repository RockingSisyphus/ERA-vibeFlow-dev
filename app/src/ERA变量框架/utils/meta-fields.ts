import _ from 'lodash';

/**
 * 返回不含 `$` 元字段的深拷贝。
 * 必须在独立纯模块中完成，否则作者只读投影会反向依赖 Sidecar 运行时并扩大状态生命周期。
 */
export function removeMetaFields<T>(value: T): T {
  if (!_.isObject(value)) return value;
  const clone = _.cloneDeep(value);
  const pending: unknown[] = [clone];
  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    if (!_.isPlainObject(current)) continue;
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      if (key.startsWith('$')) delete (current as Record<string, unknown>)[key];
      else pending.push(child);
    }
  }
  return clone;
}
