/*
 * 模块职责：在新的 Sidecar 运行时快照成功发布后，按 ERA 设置重建最近消息的显示。
 * 模块边界：只调用 Tavern Helper 的显示刷新；不写消息、Sidecar、日志或变量状态。
 */

import { settings } from '../utils/era_data';
import { subscribeSidecarRuntimeSnapshot, type SidecarRuntimeSnapshot } from './sidecar-runtime-snapshot';
import { refreshDisplayedEraTechnicalBlocks } from './technical-block-projection';

/**
 * 返回当前聊天最后 count 个安全消息 ID。必须在这里统一截断，否则设置值
 * 大于聊天长度时 Host 会收到不存在的消息 ID，并把纯显示刷新误报为业务失败。
 */
export function recentMessageIds(total: number, count: number): number[] {
  if (!Number.isSafeInteger(total) || total <= 0 || !Number.isSafeInteger(count) || count <= 0) return [];
  const start = Math.max(0, total - count);
  return Array.from({ length: total - start }, (_, index) => start + index);
}

function snapshotKey(snapshot: SidecarRuntimeSnapshot): string {
  const { identity } = snapshot;
  return [
    identity.characterId ?? '',
    identity.groupId ?? '',
    identity.chatId,
    snapshot.sidecarId,
    snapshot.revision,
  ].join('\u0000');
}

async function refreshRecentMessages(count: number): Promise<void> {
  const ids = recentMessageIds(SillyTavern.chat?.length ?? 0, count);
  for (const messageId of ids) await refreshOneMessage(messageId);
  // refreshOneMessage 重建的是宿主原始显示；必须在同一轮恢复 ERA 内建折叠/隐藏。
  refreshDisplayedEraTechnicalBlocks(ids);
}

/**
 * 每个已发布快照最多刷新一次。串行链只避免连续提交的 DOM 重建互相覆盖，
 * 不阻塞 Service 事务，也不把显示结果变成状态提交的成功条件。
 */
export function registerEraPresentationRefresh(): () => void {
  let stopped = false;
  let lastKey: string | null = null;
  let refreshChain = Promise.resolve();
  /** 快照通知只登记显示任务；不能 await DOM 刷新而阻塞 Service 的状态发布。 */
  const handleSnapshot = (snapshot: SidecarRuntimeSnapshot | null): void => {
    if (snapshot === null) {
      lastKey = null;
      return;
    }
    if (!settings.value['强制重载功能']) return;
    const key = snapshotKey(snapshot);
    if (key === lastKey) return;
    lastKey = key;
    const count = settings.value['强制重载消息数'];
    refreshChain = refreshChain
      .then(async () => {
        if (!stopped) await refreshRecentMessages(count);
      })
      .catch(error => console.error('ERA 强制重载消息显示失败。', error));
  };
  const unsubscribe = subscribeSidecarRuntimeSnapshot(handleSnapshot);

  return () => {
    if (stopped) return;
    stopped = true;
    unsubscribe();
  };
}
