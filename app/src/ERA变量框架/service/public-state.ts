import { projectFloorSnapshot } from '@era/vibeflow-floor-snapshot';
import { transformEraData } from '../utils/era-data-transform';
import { removeMetaFields } from '../utils/meta-fields';
import type { EraPublicState } from './public-api';
import type { SidecarRuntimeSnapshot } from './sidecar-runtime-snapshot';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 从 Sidecar 元数据读取与消息位置对齐的 MK 链。 */
export function selectedMks(meta: Readonly<Record<string, unknown>>): (string | null)[] {
  return Array.isArray(meta.SelectedMks)
    ? meta.SelectedMks.map(value => (typeof value === 'string' ? value : null))
    : [];
}

/**
 * 只接受当前角色、群组和聊天的 Sidecar。
 * 这一判断与公开状态投影同属“当前快照是否可展示”的入口，合并后避免
 * 每个消费者再穿过一层只包含两个小函数的转发模块。
 */
export function currentTavernIdentityMatches(snapshot: SidecarRuntimeSnapshot): boolean {
  try {
    return (
      snapshot.identity.characterId === getCurrentCharacterId() &&
      snapshot.identity.groupId === (SillyTavern.groupId || null) &&
      snapshot.identity.chatId === SillyTavern.getCurrentChatId()
    );
  } catch {
    return false;
  }
}

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

/** 唯一 snapshot_query 纯计算器的 App 侧投影入口。 */
export function projectPublicStateAtMessage(snapshot: SidecarRuntimeSnapshot, messageId: number): EraPublicState {
  const floor = projectFloorSnapshot({
    messageId,
    stat: snapshot.statData,
    statFunc: snapshot.statFunc,
    meta: snapshot.eraMeta,
  });
  return projectPublicState(snapshot, floor);
}
