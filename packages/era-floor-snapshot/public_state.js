// Generated from Service base_lib/snapshot; do not edit.
import { transformEraData, removeMetaFields, selectedMks } from './data_view.js';
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function currentMessage(selected) {
    for (let index = selected.length - 1; index >= 0; index -= 1) {
        if (selected[index] !== null)
            return { mk: selected[index], messageId: index };
    }
    return { mk: null, messageId: null };
}
function publicLog(meta, key) {
    return record(meta[key]) ? structuredClone(meta[key]) : {};
}
/**
 * 把内部快照裁剪为稳定、深拷贝且不可写的作者视图。
 * 必须拷贝全部对象字段，否则状态栏脚本可绕过 Service 直接篡改 Sidecar。
 */
export function projectPublicState(snapshot, floor) {
    const meta = snapshot?.eraMeta ?? {};
    const selected = selectedMks(meta);
    const latest = floor ?? currentMessage(selected);
    const storedStat = floor?.stat ?? snapshot?.statData ?? {};
    const stat = transformEraData(structuredClone(storedStat), 'unescape');
    return Object.freeze({
        status: snapshot === null ? 'loading' : 'ready',
        identity: snapshot === null ? null : structuredClone(snapshot.identity),
        sidecarId: snapshot?.sidecarId ?? null,
        revision: snapshot?.revision ?? null,
        statData: structuredClone(stat),
        statFunc: structuredClone(floor?.statFunc ?? snapshot?.statFunc ?? {}),
        eraMeta: structuredClone(meta),
        stat: structuredClone(stat),
        statWithoutMeta: removeMetaFields(stat),
        selectedMks: selected,
        editLogs: publicLog(meta, 'EditLogs'),
        functionEditLogs: publicLog(meta, 'FunctionEditLogs'),
        mk: latest.mk,
        message_id: floor?.messageId ?? latest.messageId,
        is_user: false,
    });
}
