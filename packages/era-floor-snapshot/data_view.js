// Generated from Service base_lib/snapshot; do not edit.
function isPlainRecord(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function mapData(value, text, omitMeta) {
    if (Array.isArray(value))
        return value.map(item => mapData(item, text, omitMeta));
    if (isPlainRecord(value)) {
        const result = {};
        for (const key of Object.keys(value)) {
            if (omitMeta && key.startsWith("$"))
                continue;
            // __proto__ 等是用户数据键，不能触发原型 setter。
            Object.defineProperty(result, text(key), { value: mapData(value[key], text, omitMeta), enumerable: true, configurable: true, writable: true });
        }
        return result;
    }
    return (typeof value === "string" ? text(value) : value);
}
/** 同时转换纯对象的键和值；保留数组位置和缺项，不修改输入。 */
export function transformEraData(value, direction) {
    const ESCAPE = { ".": "__DOT__", '"': "__DQUOTE__", "'": "__SQUOTE__" };
    const UNESCAPE = { __DOT__: ".", __DQUOTE__: '"', __SQUOTE__: "'" };
    const mapping = direction === "escape" ? ESCAPE : UNESCAPE;
    const pattern = direction === "escape" ? /[."']/g : /__DOT__|__DQUOTE__|__SQUOTE__/g;
    return mapData(value, text => text.replace(pattern, token => mapping[token]), false);
}
export function unescapeEraData(value) {
    return transformEraData(value, "unescape");
}
/** 复制可移植数据，递归移除纯对象中以美元符开头的元字段。 */
export function removeMetaFields(value) {
    return mapData(value, text => text, true);
}
export function selectedMks(meta) {
    return Array.isArray(meta.SelectedMks) ? meta.SelectedMks.map(value => typeof value === "string" ? value : null) : [];
}
/** 将点号和方括号写法转换为对象键。旧楼层日志忽略开头点号产生的空键。 */
export function pathSegments(path, preserveLeadingEmpty = true) {
    const result = [];
    if (preserveLeadingEmpty && path.startsWith('.'))
        result.push('');
    path.replace(/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g, (match, number, quote, substring) => {
        result.push(quote ? substring.replace(/\\(\\)?/g, '$1') : number || match);
        return match;
    });
    return result;
}
