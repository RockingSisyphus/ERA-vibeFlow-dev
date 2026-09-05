/**
 * 普通消息 DOM 中惰性 ERA 宏的按楼解析器。
 *
 * 它只改已经存在的文本和属性节点；绝不重新格式化整条消息，因此不会重建
 * Tavern Helper iframe，也不会再次执行状态栏作者脚本。
 */

import { projectPublicStateAtMessage } from '../service/public-state';
import { subscribeSidecarRuntimeSnapshot, type SidecarRuntimeSnapshot } from '../service/sidecar-runtime-snapshot';
import { createEraMacroSnapshotFromPublicState } from './snapshot';
import { containsEraLazyMacroToken, resolveEraLazyMacroTokens } from './syntax';

type TextBinding = { readonly source: string };
type AttributeBinding = { readonly source: string };

const textBindings = new WeakMap<Text, TextBinding>();
const attributeBindings = new WeakMap<Element, Map<string, AttributeBinding>>();

/**
 * iframe srcdoc 是独立文档的源码，不是宿主消息的可见属性。改写它会
 * 重建 iframe，并可能在楼层快照就绪前把惰性令牌解析成空值。
 */
export function elementAcceptsEraMacroProjection(element: Pick<Element, 'tagName'>): boolean {
  return !['SCRIPT', 'STYLE', 'TEXTAREA', 'IFRAME'].includes(element.tagName);
}

/** 托管状态栏源码中的惰性令牌必须留给 iframe 按楼运行时解析。 */
export function isManagedStatusbarSourceText(value: string): boolean {
  return value.includes('data-era-statusbar-bootstrap') && value.includes('data-era-statusbar-root');
}

function displayedMessageId(node: Node): number | null {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const raw = element?.closest<HTMLElement>('.mes[mesid]')?.getAttribute('mesid');
  return raw && /^\d+$/u.test(raw) ? Number(raw) : null;
}

/**
 * 首次扫描只登记惰性令牌的原始文本。
 * 脚本、样式和编辑器节点不得改写，避免破坏宿主编辑与作者代码。
 */
function bindTextNode(text: Text): void {
  if (!textBindings.has(text) && containsEraLazyMacroToken(text.nodeValue ?? '')) {
    textBindings.set(text, { source: text.nodeValue ?? '' });
  }
}

function bindElementAttributes(element: Element): void {
  let attributes = attributeBindings.get(element);
  for (const attribute of [...element.attributes]) {
    if (!containsEraLazyMacroToken(attribute.value)) continue;
    attributes ??= new Map();
    if (!attributes.has(attribute.name)) attributes.set(attribute.name, { source: attribute.value });
  }
  if (attributes) attributeBindings.set(element, attributes);
}

function bindTree(root: Element): void {
  /**
   * 只遍历可安全投影的可见节点；托管模板源码和编辑控件保持原样，
   * 否则宿主可能重建 iframe 或破坏用户正在编辑的文本。
   */
  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      bindTextNode(node as Text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (!elementAcceptsEraMacroProjection(element)) return;
    if (element.tagName === 'PRE' && isManagedStatusbarSourceText(element.textContent ?? '')) return;
    bindElementAttributes(element);
    for (const child of [...element.childNodes]) visit(child);
  };
  visit(root);
}

/**
 * 使用消息所在楼快照更新已绑定节点。
 * 历史计算失败时保留 loading 令牌，不能回退到最新楼数值。
 */
function resolveTree(root: Element, snapshot: SidecarRuntimeSnapshot): void {
  const messageId = displayedMessageId(root);
  if (messageId === null) return;
  let state;
  try {
    state = projectPublicStateAtMessage(snapshot, messageId);
  } catch {
    return;
  }
  const macroSnapshot = createEraMacroSnapshotFromPublicState(state);
  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const binding = textBindings.get(node as Text);
      if (binding) node.nodeValue = resolveEraLazyMacroTokens(binding.source, macroSnapshot);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (!elementAcceptsEraMacroProjection(element)) return;
    if (element.tagName === 'PRE' && isManagedStatusbarSourceText(element.textContent ?? '')) return;
    for (const [name, binding] of attributeBindings.get(element) ?? []) {
      element.setAttribute(name, resolveEraLazyMacroTokens(binding.source, macroSnapshot));
    }
    for (const child of [...element.childNodes]) visit(child);
  };
  visit(root);
}

function displayedRoot(messageId: number): Element | null {
  return retrieveDisplayedMessage(messageId).get(0) ?? null;
}

/** 登记 DOM 与宿主渲染事件；状态发布只原地更新绑定节点。 */
export function registerEraMacroDomRefresh(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const hostDocument = window.parent?.document ?? document;
  let current: SidecarRuntimeSnapshot | null = null;
  const pending = new Set<number>();
  let scheduled = false;
  const schedule = (messageId: number): void => {
    if (!Number.isSafeInteger(messageId) || messageId < 0) return;
    pending.add(messageId);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      for (const id of [...pending]) {
        pending.delete(id);
        const root = displayedRoot(id);
        if (!root) continue;
        bindTree(root);
        if (current) resolveTree(root, current);
      }
    });
  };
  const scheduleAll = (): void => {
    for (let index = 0; index < (SillyTavern.chat?.length ?? 0); index += 1) schedule(index);
  };
  /** 已提交 Sidecar 才驱动 DOM 投影，不观察中间计算态。 */
  const onSnapshot = (snapshot: SidecarRuntimeSnapshot | null): void => {
    current = snapshot;
    if (snapshot) scheduleAll();
  };
  const unsubscribe = subscribeSidecarRuntimeSnapshot(onSnapshot);
  const HostMutationObserver = hostDocument.defaultView?.MutationObserver;
  if (!HostMutationObserver) {
    unsubscribe();
    return () => undefined;
  }
  const observer = new HostMutationObserver(records => {
    for (const record of records) {
      const id = displayedMessageId(record.target);
      if (id !== null) schedule(id);
      for (const node of record.addedNodes) {
        const addedId = displayedMessageId(node);
        if (addedId !== null) schedule(addedId);
      }
    }
  });
  observer.observe(hostDocument.documentElement, { childList: true, subtree: true });
  const rendered = (messageId: number) => schedule(messageId);
  const all = () => scheduleAll();
  const events = [
    tavern_events.USER_MESSAGE_RENDERED,
    tavern_events.CHARACTER_MESSAGE_RENDERED,
    tavern_events.MESSAGE_UPDATED,
    tavern_events.MESSAGE_SWIPED,
  ];
  for (const event of events) eventMakeLast(event, rendered);
  eventMakeLast(tavern_events.MORE_MESSAGES_LOADED, all);
  eventMakeLast(tavern_events.CHAT_CHANGED, all);
  scheduleAll();

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    unsubscribe();
    for (const event of events) eventRemoveListener(event, rendered);
    eventRemoveListener(tavern_events.MORE_MESSAGES_LOADED, all);
    eventRemoveListener(tavern_events.CHAT_CHANGED, all);
    pending.clear();
  };
}
