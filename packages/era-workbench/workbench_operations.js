// Generated from Service base_lib/workbench; do not edit.
export function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function defineOwn(target, key, value) {
    Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
    });
}
/** 按 JSON 结构比较两个草稿；必须忽略对象键顺序，否则纯排序会制造假操作。 */
export function jsonEqual(left, right) {
    if (Object.is(left, right))
        return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return (Array.isArray(left) &&
            Array.isArray(right) &&
            left.length === right.length &&
            left.every((value, index) => jsonEqual(value, right[index])));
    }
    if (!isRecord(left) || !isRecord(right))
        return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return (leftKeys.length === rightKeys.length &&
        leftKeys.every((key, index) => key === rightKeys[index] && jsonEqual(left[key], right[key])));
}
/** 只沿自有键读取子树，避免原型属性被误当作可编辑的 ERA 变量。 */
export function valueAtPath(root, path) {
    let cursor = root;
    for (const segment of path) {
        if (!isRecord(cursor) && !Array.isArray(cursor))
            return undefined;
        if (!Object.prototype.hasOwnProperty.call(cursor, segment))
            return undefined;
        cursor = cursor[segment];
    }
    return cursor;
}
/** 把子树包装成 ERA CRUD 的嵌套 payload；必须克隆草稿，避免后续输入反向篡改 commit。 */
export function payloadAtPath(path, value) {
    if (path.length === 0) {
        if (!isRecord(value))
            throw new TypeError('变量根操作必须是对象。');
        return structuredClone(value);
    }
    const root = {};
    let cursor = root;
    path.forEach((segment, index) => {
        if (index === path.length - 1) {
            defineOwn(cursor, segment, structuredClone(value));
            return;
        }
        const child = {};
        defineOwn(cursor, segment, child);
        cursor = child;
    });
    return root;
}
export function operation(kind, path, value) {
    const payload = payloadAtPath(path, value);
    if (kind === 'insert')
        return { insert: payload };
    if (kind === 'edit')
        return { edit: payload };
    return { delete: payload };
}
export function pathLabel(path) {
    return path.length === 0 ? '<root>' : path.join('.');
}
/** 高级模式保留用户顺序，不推断或增加解锁。 */
export function normalizeOrderedOperations(value) {
    if (!Array.isArray(value) || !value.length)
        throw new TypeError('有序操作必须是非空 JSON 数组。');
    return value.map(item => {
        if (!isRecord(item))
            throw new TypeError('操作必须是对象。');
        const keys = Object.keys(item);
        if (keys.length !== 1 || !['insert', 'edit', 'delete'].includes(keys[0]) || !isRecord(item[keys[0]])) {
            throw new TypeError('操作只能包含 insert、edit 或 delete 之一，载荷必须是对象。');
        }
        return structuredClone(item);
    });
}
