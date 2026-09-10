import { transformEraData, removeMetaFields, selectedMks } from './data_view.js';
export interface SidecarRuntimeIdentity {
  readonly characterId: string | null;
  readonly groupId: string | null;
  readonly chatId: string;
}

/**
 * 宏可读取的当前页面易失缓存：只能由成功文件事务发布，不能充当持久化来源。
 */
export interface SidecarRuntimeSnapshot {
  readonly identity: SidecarRuntimeIdentity;
  readonly sidecarId: string;
  readonly revision: number;
  readonly statData: unknown;
  readonly statFunc: Record<string, unknown>;
  readonly eraMeta: Record<string, unknown>;
}

export interface EraPublicState {
  readonly status: 'ready' | 'loading';
  readonly identity: SidecarRuntimeSnapshot['identity'] | null;
  readonly sidecarId: string | null;
  readonly revision: number | null;
  readonly statData: unknown;
  readonly statFunc: Readonly<Record<string, unknown>>;
  readonly eraMeta: Readonly<Record<string, unknown>>;
  readonly stat: unknown;
  readonly statWithoutMeta: unknown;
  readonly selectedMks: readonly (string | null)[];
  readonly editLogs: Readonly<Record<string, unknown>>;
  readonly functionEditLogs: Readonly<Record<string, unknown>>;
  readonly mk: string | null;
  readonly message_id: number | null;
  readonly is_user: false;
}


function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function currentMessage(selected: readonly (string | null)[]): {
  readonly mk: string | null;
  readonly messageId: number | null;
} {
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    if (selected[index] !== null) return { mk: selected[index]!, messageId: index };
  }
  return { mk: null, messageId: null };
}

function publicLog(meta: Readonly<Record<string, unknown>>, key: 'EditLogs' | 'FunctionEditLogs') {
  return record(meta[key]) ? structuredClone(meta[key]) : {};
}

/**
 * 把内部快照裁剪为稳定、深拷贝且不可写的作者视图。
 * 必须拷贝全部对象字段，否则状态栏脚本可绕过 Service 直接篡改 Sidecar。
 */
export function projectPublicState(
  snapshot: SidecarRuntimeSnapshot | null,
  floor?: Readonly<{ messageId: number; mk: string; stat: unknown; statFunc: Readonly<Record<string, unknown>> }>,
): EraPublicState {
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
    is_user: false as const,
  });
}

