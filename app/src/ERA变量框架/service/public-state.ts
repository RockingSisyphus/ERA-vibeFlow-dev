import { projectFloorSnapshot, projectPublicState } from '@era/vibeflow-floor-snapshot';
export { selectedMks, projectPublicState } from '@era/vibeflow-floor-snapshot';
import type { EraPublicState } from './public-api';
import type { SidecarRuntimeSnapshot } from './sidecar-runtime-snapshot';

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
