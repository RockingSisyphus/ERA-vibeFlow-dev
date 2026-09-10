// Generated from Service base_lib/domain; do not edit.
/** 工作台共享纯计算；生产 Service 节点与 UI 预览由同一源码构建。 */
import { isRecord, jsonEqual, valueAtPath, operation } from './workbench_operations.js';
function metaAt(value) {
    return isRecord(value) && isRecord(value.$meta) ? value.$meta : {};
}
/** 将一层祖先元数据投影为最多一个阻断事实，避免同一锁重复解锁。 */
function protectionAtDepth(root, path, kind, depth) {
    const ancestorPath = path.slice(0, depth);
    const meta = metaAt(valueAtPath(root, ancestorPath));
    if (kind === 'edit' && meta.updatable === false) {
        return { path: ancestorPath, field: 'updatable', value: false };
    }
    if (kind === 'insert' && meta.unInsertAble === 'all') {
        return { path: ancestorPath, field: 'unInsertAble', value: 'all' };
    }
    if (kind === 'insert' && depth === path.length - 1 && meta.unInsertAble === 'self') {
        return { path: ancestorPath, field: 'unInsertAble', value: 'self' };
    }
    return kind === 'delete' ? deletionProtection(ancestorPath, meta, depth, path.length) : null;
}
/** 删除保护的 self、children 和 all 传递范围独立计算，避免污染其他操作分支。 */
function deletionProtection(path, meta, depth, targetDepth) {
    if (meta.necessary === 'all' || (depth === targetDepth && meta.necessary === 'self')) {
        return { path, field: 'necessary', value: meta.necessary };
    }
    return depth === targetDepth - 1 && meta.necessary === 'children'
        ? { path, field: 'necessary', value: 'children' }
        : null;
}
/**
 * 收集目标及其所有祖先的变量保护。祖先限制会传递给子路径，
 * 所以只检查直接目标会让 UI 生成必然失败的 commit。
 */
export function variableProtections(root, path, kind) {
    const result = [];
    for (let depth = 0; depth <= path.length; depth += 1) {
        const protection = protectionAtDepth(root, path, kind, depth);
        if (protection !== null)
            result.push(protection);
    }
    return result.filter((item, index, items) => items.findIndex(other => other.field === item.field && jsonEqual(other.path, item.path)) === index);
}
export function variablePlanProtections(root, plan) {
    return plan.changes
        .flatMap(change => variableProtections(root, change.path, change.kind))
        .filter((item, index, items) => items.findIndex(other => other.field === item.field && jsonEqual(other.path, item.path)) === index);
}
function metaEdit(path, field, value) {
    return operation('edit', path, { $meta: { [field]: value } });
}
function metaDelete(path, field) {
    return operation('delete', path, { $meta: { [field]: {} } });
}
/** 删除或替换掉承载元数据的对象后不能恢复旧锁，否则会重建已删除实体。 */
function variableProtectionSurvives(operations, path) {
    let survives = true;
    for (const entry of operations) {
        if ('delete' in entry) {
            for (let depth = 1; depth <= path.length; depth += 1) {
                const deletion = valueAtPath(entry.delete, path.slice(0, depth));
                if (isRecord(deletion) && Object.keys(deletion).length === 0)
                    survives = false;
            }
        }
        if ('insert' in entry) {
            const replacement = valueAtPath(entry.insert, path);
            if (replacement !== undefined)
                survives = isRecord(replacement);
        }
    }
    return survives;
}
/** 解锁与可选恢复必须包在同一次 commit，否则中间失败会留下意外解锁状态。 */
export function wrapVariableProtection(operations, protections, choice) {
    if (choice === 'temporary' && protections.some(item => item.field === 'necessary'))
        throw new TypeError('necessary 保护不能临时解除。');
    const unlocks = [];
    const restores = [];
    for (const protection of protections) {
        if (protection.field === 'necessary') {
            unlocks.push(metaDelete(protection.path, protection.field));
            continue;
        }
        unlocks.push(metaEdit(protection.path, protection.field, protection.field === 'updatable' ? true : null));
        if (choice === 'temporary' && variableProtectionSurvives(operations, protection.path)) {
            restores.unshift(metaEdit(protection.path, protection.field, protection.value));
        }
    }
    return [...unlocks, ...operations, ...restores];
}
/** 只读取与当前操作相关的函数保护，避免解锁不影响本次提交的元数据。 */
export function functionProtection(definition, kind) {
    const meta = metaAt(definition);
    if (kind === 'edit' && meta.updatable === false) {
        return [{ path: [], field: 'updatable', value: false }];
    }
    if (kind === 'delete' && (meta.necessary === 'self' || meta.necessary === 'all')) {
        return [{ path: [], field: 'necessary', value: meta.necessary }];
    }
    return [];
}
/** 函数解锁必须环绕原操作且不改顺序，否则表达式重放将看到不同定义。 */
export function wrapFunctionProtection(name, operations, protections, choice) {
    return wrapFunctionPlanProtections(operations, protections.map(item => ({ ...item, name })), choice);
}
/** 批量草稿必须保留保护对应的函数名，否则无法向正确定义发出解锁。 */
export function functionPlanProtections(original, plan) {
    return plan.changes
        .filter(change => change.kind !== 'insert')
        .flatMap(change => functionProtection(original[change.name], change.kind === 'delete' ? 'delete' : 'edit').map(protection => ({
        ...protection,
        name: change.name,
    })));
}
/** 批量解锁先集中前置、恢复再逆序后置，避免父子保护的恢复顺序相反。 */
export function wrapFunctionPlanProtections(operations, protections, choice) {
    if (choice === 'temporary' && protections.some(item => item.field === 'necessary'))
        throw new TypeError('necessary 保护不能临时解除。');
    const unlocks = [];
    const restores = [];
    for (const protection of protections) {
        if (protection.field === 'necessary') {
            unlocks.push({ functionDelete: { [protection.name]: { $meta: { necessary: {} } } } });
            continue;
        }
        unlocks.push({ functionEdit: { [protection.name]: { $meta: { updatable: true } } } });
        if (choice === 'temporary' && !operations.some(entry => 'functionDelete' in entry && isRecord(entry.functionDelete[protection.name]) && Object.keys(entry.functionDelete[protection.name]).length === 0)) {
            restores.unshift({ functionEdit: { [protection.name]: { $meta: { updatable: protection.value } } } });
        }
    }
    return [...unlocks, ...operations, ...restores];
}
