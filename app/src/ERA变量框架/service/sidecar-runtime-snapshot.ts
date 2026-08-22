/**
 * 当前页面实例的易失 Sidecar 快照。
 *
 * 它只解决宏必须同步读取而 files API 必须异步读取的边界：唯一持久化真相仍是
 * Sidecar 用户文件。写入者必须是 Service 通过受限 Host capability；身份不匹配
 * 时读者一律得到空状态，绝不回退到聊天变量或上一聊天快照。
 */

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
  readonly eraMeta: Record<string, unknown>;
}

let active: SidecarRuntimeSnapshot | null = null;

function sameIdentity(left: SidecarRuntimeIdentity, right: SidecarRuntimeIdentity): boolean {
  return left.characterId === right.characterId && left.groupId === right.groupId && left.chatId === right.chatId;
}

export function publishSidecarRuntimeSnapshot(snapshot: SidecarRuntimeSnapshot): void {
  active = structuredClone(snapshot);
}

export function clearSidecarRuntimeSnapshot(): void {
  active = null;
}

/** 返回同步宏可安全读取的状态；没有匹配快照时为 null。 */
export function readSidecarRuntimeSnapshot(identity: SidecarRuntimeIdentity): SidecarRuntimeSnapshot | null {
  return active !== null && sameIdentity(active.identity, identity) ? structuredClone(active) : null;
}
