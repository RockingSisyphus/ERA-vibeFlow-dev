import _ from 'lodash';
export type EraDataTransformDirection = 'escape' | 'unescape';
function transformWithMapping<T>(data: T, mapping: Readonly<Record<string, string>>, pattern: RegExp): T {
  if (Array.isArray(data)) return data.map(item => transformWithMapping(item, mapping, pattern)) as T;
  if (_.isPlainObject(data)) {
    const transformed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      transformed[key.replace(pattern, match => mapping[match]!)] = transformWithMapping(value, mapping, pattern);
    }
    return transformed as T;
  }
  if (typeof data === 'string') return data.replace(pattern, match => mapping[match]!) as T;
  return data;
}

/** 同一遍历使用同一映射，保持原对象键和值的转换语义。 */
export function transformEraData<T>(data: T, direction: EraDataTransformDirection): T {
const ESCAPE_MAP: Readonly<Record<string, string>> = {
  '.': '__DOT__',
  '"': '__DQUOTE__',
  "'": '__SQUOTE__',
};

const UNESCAPE_MAP: Readonly<Record<string, string>> = _.invert(ESCAPE_MAP);
const escapeRegex = new RegExp(Object.keys(ESCAPE_MAP).map(_.escapeRegExp).join('|'), 'g');
const unescapeRegex = new RegExp(Object.values(ESCAPE_MAP).map(_.escapeRegExp).join('|'), 'g');


 return transformWithMapping(data, direction === 'escape' ? ESCAPE_MAP : UNESCAPE_MAP, direction === 'escape' ? escapeRegex : unescapeRegex);
}


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

export function selectedMks(meta: Readonly<Record<string, unknown>>): (string | null)[] {
  return Array.isArray(meta.SelectedMks) ? meta.SelectedMks.map(value => typeof value === "string" ? value : null) : [];
}
