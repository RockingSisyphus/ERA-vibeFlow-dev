// Generated from Service base_lib/domain; do not edit.
import _ from 'lodash';
function transformWithMapping(data, mapping, pattern) {
    if (Array.isArray(data))
        return data.map(item => transformWithMapping(item, mapping, pattern));
    if (_.isPlainObject(data)) {
        const transformed = {};
        for (const [key, value] of Object.entries(data)) {
            transformed[key.replace(pattern, match => mapping[match])] = transformWithMapping(value, mapping, pattern);
        }
        return transformed;
    }
    if (typeof data === 'string')
        return data.replace(pattern, match => mapping[match]);
    return data;
}
/** 同一遍历使用同一映射，保持原对象键和值的转换语义。 */
export function transformEraData(data, direction) {
    const ESCAPE_MAP = {
        '.': '__DOT__',
        '"': '__DQUOTE__',
        "'": '__SQUOTE__',
    };
    const UNESCAPE_MAP = _.invert(ESCAPE_MAP);
    const escapeRegex = new RegExp(Object.keys(ESCAPE_MAP).map(_.escapeRegExp).join('|'), 'g');
    const unescapeRegex = new RegExp(Object.values(ESCAPE_MAP).map(_.escapeRegExp).join('|'), 'g');
    return transformWithMapping(data, direction === 'escape' ? ESCAPE_MAP : UNESCAPE_MAP, direction === 'escape' ? escapeRegex : unescapeRegex);
}
/**
 * 返回不含 `$` 元字段的深拷贝。
 * 必须在独立纯模块中完成，否则作者只读投影会反向依赖 Sidecar 运行时并扩大状态生命周期。
 */
export function removeMetaFields(value) {
    if (!_.isObject(value))
        return value;
    const clone = _.cloneDeep(value);
    const pending = [clone];
    while (pending.length > 0) {
        const current = pending.pop();
        if (Array.isArray(current)) {
            pending.push(...current);
            continue;
        }
        if (!_.isPlainObject(current))
            continue;
        for (const [key, child] of Object.entries(current)) {
            if (key.startsWith('$'))
                delete current[key];
            else
                pending.push(child);
        }
    }
    return clone;
}
export function selectedMks(meta) {
    return Array.isArray(meta.SelectedMks) ? meta.SelectedMks.map(value => typeof value === "string" ? value : null) : [];
}
