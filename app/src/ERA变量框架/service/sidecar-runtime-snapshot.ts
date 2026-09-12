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
  readonly statFunc: Record<string, unknown>;
  readonly eraMeta: Record<string, unknown>;
}

let active: SidecarRuntimeSnapshot | null = null;
const subscribers = new Set<(snapshot: SidecarRuntimeSnapshot | null) => void>();

function notify(snapshot: SidecarRuntimeSnapshot | null): void {
  for (const subscriber of [...subscribers]) {
    try {
      subscriber(snapshot === null ? null : structuredClone(snapshot));
    } catch (error) {
      console.error('ERA 状态订阅者执行失败，已隔离该回调。', error);
    }
  }
}

function sameIdentity(left: SidecarRuntimeIdentity, right: SidecarRuntimeIdentity): boolean {
  return left.characterId === right.characterId && left.groupId === right.groupId && left.chatId === right.chatId;
}

export function publishSidecarRuntimeSnapshot(snapshot: SidecarRuntimeSnapshot, notifySubscribers = true): void {
  active = structuredClone(snapshot);
  if (notifySubscribers) notify(active);
}

export function clearSidecarRuntimeSnapshot(): void {
  active = null;
  notify(null);
}

/**
 * 订阅当前页面实例的已提交 Sidecar 状态。订阅者只接收成功文件事务发布的
 * 快照；为了避免跨聊天串线，聊天切换、stop 与 pagehide 会收到 null，绝不回退到聊天变量。
 */
export function subscribeSidecarRuntimeSnapshot(
  subscriber: (snapshot: SidecarRuntimeSnapshot | null) => void,
): () => void {
  subscribers.add(subscriber);
  try {
    subscriber(active === null ? null : structuredClone(active));
  } catch (error) {
    subscribers.delete(subscriber);
    console.error('ERA 状态订阅者初始化失败，已取消该订阅。', error);
  }
  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    subscribers.delete(subscriber);
  };
}

/** 读取当前页面唯一快照；公共 facade 会在返回前再核对 Tavern 身份。 */
export function readActiveSidecarRuntimeSnapshot(): SidecarRuntimeSnapshot | null {
  return active === null ? null : structuredClone(active);
}

/** 返回同步宏可安全读取的状态；没有匹配快照时为 null。 */
export function readSidecarRuntimeSnapshot(identity: SidecarRuntimeIdentity): SidecarRuntimeSnapshot | null {
  return active !== null && sameIdentity(active.identity, identity) ? structuredClone(active) : null;
}
