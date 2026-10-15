/**
 * @file 当前页面实例的工作状态与Sidecar投影
 * @description 负责保存Service发布的页面内状态及只读投影；不执行变量规则，所有写入依赖Service的受限能力。
 *
 * 它为宏和 API 同步投影当前工作状态；聊天记录与 Sidecar 在批次结束时持久化。写入者必须是 Service 通过受限 Host capability；身份不匹配
 * 时读者一律得到空状态，绝不回退到聊天变量或上一聊天快照。
 */
export const SIDECAR_PROMPT_EVENT = 'era-sidecar-binding-prompt';

/** 当前工作状态的角色、群组和聊天身份，供同步读取严格匹配。 */
export interface SidecarRuntimeIdentity {
  readonly characterId: string | null;
  readonly groupId: string | null;
  readonly chatId: string;
}

/**
 * 宏和 API 可读取的工作状态投影；内存应用即时刷新，保存完成后才通知订阅者。
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
  clearWorkingState();
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

/** Service写入的批次状态和消息草稿；未保存批次按聊天隔离保留，返回后由Service核对来源。 */
export interface EraWorkingState {
  readonly identity: SidecarRuntimeIdentity;
  readonly version: number;
  readonly record: Record<string, unknown>;
  readonly work: Record<string, unknown> | null;
  readonly sourceBasis: Record<string, unknown> | null;
  readonly dirty: boolean;
  readonly stage?: Record<string, unknown> | null;
}

const workingByChat = new Map<string, EraWorkingState>();

function workingKey(identity: SidecarRuntimeIdentity): string {
  return JSON.stringify([identity.characterId, identity.groupId, identity.chatId]);
}

/** 返回指定聊天的独立副本；Service仍须核对正文、Swipe及Sidecar来源后才能续做。 */
export function readWorkingState(identity: SidecarRuntimeIdentity): EraWorkingState | null {
  const working = workingByChat.get(workingKey(identity));
  return working ? structuredClone(working) : null;
}

export function storeWorkingState(state: EraWorkingState): void {
  const key = workingKey(state.identity);
  // 已保存的非当前聊天可从Sidecar重新加载；仅保留确有待保存内容的旧批次。
  for (const [other, previous] of workingByChat) {
    if (other !== key && !previous.dirty) workingByChat.delete(other);
  }
  workingByChat.set(key, structuredClone(state));
}

export function clearWorkingState(): void {
  workingByChat.clear();
}
