/**
 * 托管状态栏的楼层身份求证器。
 *
 * 本模块只从当前页面、消息和 Sidecar 重建身份，不缓存历史关系，
 * 因此 reload、切换聊天与宿主重启后不会依赖丢失的旧内存。
 */

import { currentTavernIdentityMatches, selectedMks } from './public-state';
import { readActiveSidecarRuntimeSnapshot } from './sidecar-runtime-snapshot';
import {
  activeMessageText,
  currentSwipeId,
  iframeMessageId,
  messageMk,
  parentMessageId,
} from './statusbar-message-identity';
import type { ManagedFrame } from './statusbar-runtime-support';

/** 页面实例内经多源交叉核对后的楼层身份。 */
export interface EraStatusbarIdentity {
  readonly pageEpoch: string;
  readonly instanceId: string;
  readonly characterId: string | null;
  readonly groupId: string | null;
  readonly chatId: string;
  readonly messageId: number;
  readonly mk: string;
  readonly swipeId: number;
  readonly iframeName: string;
}

/** 写入通道使用的不透明来源，不允许作者通过 options 伪造。 */
export interface EraStatusbarSource extends EraStatusbarIdentity {
  readonly kind: 'managed-statusbar-v2';
}

function helperMessageId(frame: ManagedFrame): number | null {
  try {
    const value = frame.getCurrentMessageId?.();
    return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
  } catch {
    return null;
  }
}

function agreedMessageId(values: readonly (number | null)[]): number {
  const ids = values.filter((value): value is number => value !== null);
  if (ids.length !== 3 || new Set(ids).size !== 1) throw new Error('ERA_STATUSBAR_MESSAGE_ID_CONFLICT');
  return ids[0]!;
}

/** 跨 Window realm 仅核对 DOM 节点语义，不使用会失效的 instanceof。 */
export function isStatusbarIframeElement(value: Element | null): value is HTMLIFrameElement {
  return value?.localName === 'iframe';
}

/**
 * 同时核对 Helper、iframe 名称、父消息、当前 Swipe 和 Sidecar。
 * 任一来源尚未就绪时必须失败并继续 loading，否则会误显示最新楼。
 */
export function deriveStatusbarIdentity(
  pageEpoch: string,
  frame: ManagedFrame,
  root: HTMLElement,
): EraStatusbarIdentity {
  const frameElement = frame.frameElement;
  // message iframe 与 ERA 角色卡脚本位于不同 Window realm；跨 realm 的
  // `instanceof HTMLIFrameElement` 会将真实 iframe 误判为非 iframe。身份仍由
  // 后续的名称、父消息、Helper messageId 和 MK/Sidecar 联合求证。
  if (!isStatusbarIframeElement(frameElement)) throw new Error('ERA_STATUSBAR_FRAME_MISSING');
  const iframeElement = frameElement;
  const iframeName = frame.name || iframeElement.id;
  const messageId = agreedMessageId([
    iframeMessageId(iframeName) ?? iframeMessageId(iframeElement.id),
    parentMessageId(iframeElement),
    helperMessageId(frame),
  ]);
  const message = getChatMessages(messageId, { include_swipes: true })[0];
  const text = activeMessageText(message);
  if (text === null) throw new Error('ERA_STATUSBAR_MESSAGE_MISSING');
  if (/<era_block\b[^>]*\bapplied=["']1["']/iu.test(text)) throw new Error('ERA_STATUSBAR_SELECTED_MK_NOT_READY');
  const mk = messageMk(text);
  if (mk === null) throw new Error('ERA_STATUSBAR_MK_NOT_READY');
  const snapshot = readActiveSidecarRuntimeSnapshot();
  if (snapshot === null || !currentTavernIdentityMatches(snapshot)) throw new Error('ERA_STATUSBAR_SIDECAR_NOT_READY');
  if (snapshot.identity.groupId !== null) throw new Error('ERA_STATUSBAR_GROUP_UNSUPPORTED');
  if (selectedMks(snapshot.eraMeta)[messageId] !== mk) throw new Error('ERA_STATUSBAR_SELECTED_MK_NOT_READY');
  if (!root.hasAttribute('data-era-statusbar-root')) throw new Error('ERA_STATUSBAR_ROOT_MISSING');
  return {
    pageEpoch,
    instanceId: globalThis.crypto?.randomUUID?.() ?? `era-statusbar-${Date.now()}-${Math.random()}`,
    characterId: snapshot.identity.characterId,
    groupId: snapshot.identity.groupId,
    chatId: snapshot.identity.chatId,
    messageId,
    mk,
    swipeId: currentSwipeId(message),
    iframeName,
  };
}

/**
 * 写入前再次核对消息、Swipe、MK 与聊天身份。
 * 身份不一致就拒绝，避免历史状态栏错写到最新楼。
 */
export function verifyStatusbarIdentity(identity: EraStatusbarIdentity): boolean {
  const snapshot = readActiveSidecarRuntimeSnapshot();
  if (snapshot === null || !currentTavernIdentityMatches(snapshot)) return false;
  if (
    snapshot.identity.characterId !== identity.characterId ||
    snapshot.identity.groupId !== identity.groupId ||
    snapshot.identity.chatId !== identity.chatId
  )
    return false;
  const message = getChatMessages(identity.messageId, { include_swipes: true })[0];
  const text = activeMessageText(message);
  return (
    text !== null &&
    !/<era_block\b[^>]*\bapplied=["']1["']/iu.test(text) &&
    messageMk(text) === identity.mk &&
    currentSwipeId(message) === identity.swipeId &&
    selectedMks(snapshot.eraMeta)[identity.messageId] === identity.mk
  );
}
