import _ from 'lodash';

export type EraDataTransformDirection = 'escape' | 'unescape';

const ESCAPE_MAP: Readonly<Record<string, string>> = {
  '.': '__DOT__',
  '"': '__DQUOTE__',
  "'": '__SQUOTE__',
};

const UNESCAPE_MAP: Readonly<Record<string, string>> = _.invert(ESCAPE_MAP);
const escapeRegex = new RegExp(Object.keys(ESCAPE_MAP).map(_.escapeRegExp).join('|'), 'g');
const unescapeRegex = new RegExp(Object.values(ESCAPE_MAP).map(_.escapeRegExp).join('|'), 'g');

/**
 * 用同一递归规则转换 ERA 的对象键与字符串值。
 * 必须共用这条纯路径，否则写入和作者读取会因两份转义实现漂移而无法往返。
 */
export function transformEraData<T>(data: T, direction: EraDataTransformDirection): T {
  const mapping = direction === 'escape' ? ESCAPE_MAP : UNESCAPE_MAP;
  const pattern = direction === 'escape' ? escapeRegex : unescapeRegex;
  if (Array.isArray(data)) return data.map(item => transformEraData(item, direction)) as T;
  if (_.isPlainObject(data)) {
    const transformed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      transformed[key.replace(pattern, match => mapping[match]!)] = transformEraData(value, direction);
    }
    return transformed as T;
  }
  if (typeof data === 'string') return data.replace(pattern, match => mapping[match]!) as T;
  return data;
}
