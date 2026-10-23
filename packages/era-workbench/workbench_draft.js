// Generated from Service base_lib/workbench; do not edit.
/** 工作台共享纯计算；生产 Service 节点与 UI 预览由同一源码构建。 */
import { defineOwn, isRecord, jsonEqual, operation, pathLabel } from './workbench_operations.js';
function diffAtPath(original, draft, path, operations, changedPaths, changes) {
    if (jsonEqual(original, draft))
        return;
    // `$template` 是 ERA 控制字段；CRUD 引擎会拒绝 VariableEdit 中的未知 `$` 键。
    // 因此已有模板必须通过受支持的 Delete -> Insert 有序操作更新。
    // `$meta` 仍可直接编辑，不需要经过这个类型替换边界。
    if (path.at(-1) === '$template') {
        operations.push(operation('delete', path, {}));
        operations.push(operation('insert', path, draft));
        changedPaths.push(pathLabel(path));
        changes.push({ path, kind: 'delete' }, { path, kind: 'insert' });
        return;
    }
    const originalObject = isRecord(original);
    const draftObject = isRecord(draft);
    if (originalObject && draftObject) {
        const keys = new Set([...Object.keys(original), ...Object.keys(draft)]);
        for (const key of keys) {
            const hasOriginal = Object.prototype.hasOwnProperty.call(original, key);
            const hasDraft = Object.prototype.hasOwnProperty.call(draft, key);
            const childPath = [...path, key];
            if (!hasOriginal) {
                operations.push(operation('insert', childPath, draft[key]));
                changedPaths.push(pathLabel(childPath));
                changes.push({ path: childPath, kind: 'insert' });
            }
            else if (!hasDraft) {
                operations.push(operation('delete', childPath, {}));
                changedPaths.push(pathLabel(childPath));
                changes.push({ path: childPath, kind: 'delete' });
            }
            else {
                diffAtPath(original[key], draft[key], childPath, operations, changedPaths, changes);
            }
        }
        return;
    }
    if (originalObject !== draftObject) {
        operations.push(operation('delete', path, {}));
        operations.push(operation('insert', path, draft));
        changes.push({ path, kind: 'delete' }, { path, kind: 'insert' });
    }
    else {
        operations.push(operation('edit', path, draft));
        changes.push({ path, kind: 'edit' });
    }
    changedPaths.push(pathLabel(path));
}
export function planVariableDiff(original, draft, path = []) {
    const operations = [];
    const changedPaths = [];
    const changes = [];
    diffAtPath(original, draft, path, operations, changedPaths, changes);
    return { operations, changedPaths, changes };
}
export function planVariableInsert(path, value) {
    return {
        operations: [operation('insert', path, value)],
        changedPaths: [pathLabel(path)],
        changes: [{ path, kind: 'insert' }],
    };
}
export function planVariableDelete(path) {
    return {
        operations: [operation('delete', path, {})],
        changedPaths: [pathLabel(path)],
        changes: [{ path, kind: 'delete' }],
    };
}
export function planVariableExpression(path, expr) {
    if (path.length === 0)
        throw new TypeError('$expr 不能以变量根作为目标。');
    return {
        operations: [operation('edit', path, { $expr: expr })],
        changedPaths: [pathLabel(path)],
        changes: [{ path, kind: 'edit' }],
    };
}
/** 函数库必须按 Insert、Edit、Delete 分批，因为引用关系要在删除前看到新定义。 */
export function planFunctionLibraryDiff(original, draft) {
    const inserted = {};
    const edited = {};
    const deleted = {};
    const changedNames = [];
    const changes = [];
    for (const name of new Set([...Object.keys(original), ...Object.keys(draft)])) {
        const had = Object.prototype.hasOwnProperty.call(original, name);
        const has = Object.prototype.hasOwnProperty.call(draft, name);
        if (!had && has) {
            defineOwn(inserted, name, structuredClone(draft[name]));
            changes.push({ name, kind: 'insert' });
        }
        else if (had && !has) {
            defineOwn(deleted, name, {});
            changes.push({ name, kind: 'delete' });
        }
        else if (!jsonEqual(original[name], draft[name])) {
            defineOwn(edited, name, structuredClone(draft[name]));
            changes.push({ name, kind: 'edit' });
        }
        else
            continue;
        changedNames.push(name);
    }
    const operations = [];
    if (Object.keys(inserted).length > 0)
        operations.push({ functionInsert: inserted });
    if (Object.keys(edited).length > 0)
        operations.push({ functionEdit: edited });
    if (Object.keys(deleted).length > 0)
        operations.push({ functionDelete: deleted });
    return { operations, changedNames, changes };
}
