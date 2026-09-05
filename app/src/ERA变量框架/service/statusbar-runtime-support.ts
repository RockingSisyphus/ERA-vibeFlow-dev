/**
 * ERA 托管状态栏的无状态 DOM 与消息辅助函数。
 *
 * 本模块只负责可独立测试的读取、绑定和范围计算；不保存 Sidecar
 * 或运行实例，也不决定写入目标，避免 DOM 工具变成第二套业务状态机。
 */

import { createEraMacroSnapshotFromPublicState } from '../macro/snapshot';
import {
  createEraLazyMacroToken,
  createEraMacroRegex,
  containsEraMacro,
  resolveEraLazyMacroTokens,
} from '../macro/syntax';
import type { EraPublicState, EraStatusbarOverflow } from './public-api';
import type { SidecarRuntimeSnapshot } from './sidecar-runtime-snapshot';
import { activeMessageText } from './statusbar-message-identity';

export type ManagedFrame = Window & {
  ERA?: import('./public-api').EraFacade;
  getCurrentMessageId?: () => number;
};

export type MacroBinding =
  | { readonly kind: 'text'; readonly node: Text; readonly source: string }
  | { readonly kind: 'attribute'; readonly element: Element; readonly name: string; readonly source: string };

export interface MacroBindingHost {
  readonly state: EraPublicState | null;
  readonly macroBindings: readonly MacroBinding[];
}

/**
 * 把 Tavern Helper 已转换的惰性 token 与 reload 早期遗留的字面宏
 * 统一为同一种绑定源码，且不递归解析变量值中恰好出现的宏字面量。
 */
export function normalizeStatusbarMacroBindingSource(source: string): string | null {
  const normalized = containsEraMacro(source)
    ? source.replace(createEraMacroRegex(), substring => createEraLazyMacroToken(substring))
    : source;
  return normalized.includes('__ERA_LAZY_MACRO_V2_') ? normalized : null;
}

type ComparableSource = Readonly<{
  readonly kind: 'managed-statusbar-v2';
  readonly pageEpoch: string;
  readonly instanceId: string;
  readonly characterId: string | null;
  readonly groupId: string | null;
  readonly chatId: string;
  readonly messageId: number;
  readonly mk: string;
  readonly swipeId: number;
  readonly iframeName: string;
}>;

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function summaryFor(text: string): string {
  return text
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 72);
}

export function effectiveOverflow(root: HTMLElement, defaultOverflow: EraStatusbarOverflow): EraStatusbarOverflow {
  const local = root.dataset.eraOverflow;
  if (local === 'placeholder' || local === 'empty' || local === 'hidden') return local;
  return defaultOverflow;
}

/** 声明式强制显示只接受明确 true，避免把任意非空字符串当成开关。 */
export function rootForcesDisplay(root: HTMLElement): boolean {
  return root.dataset.eraForceDisplay === 'true';
}

/** 投影键包含 Sidecar 版本和显示策略，否则设置变化会复用过期缓存。 */
export function projectionKey(
  snapshot: SidecarRuntimeSnapshot | null,
  selectedMessageId: number | null,
  historyRange: number,
): string | null {
  return snapshot
    ? `${snapshot.sidecarId}\u0000${snapshot.revision}\u0000${historyRange}\u0000${selectedMessageId ?? ''}`
    : null;
}

/**
 * 只有当前角色卡正则明确包含 V2 模板才枚举托管楼层。
 * 旧卡必须继续由旧模板运行，避免暗中升级后套用不兼容语义。
 */
export function managedStatusbarMessageIds(): number[] {
  try {
    const regex = getTavernRegexes({ type: 'character' }).find(candidate => candidate.script_name === 'ERA 状态栏模板');
    if (!regex?.replace_string.includes('data-era-statusbar-root')) return [];
  } catch {
    return [];
  }
  const result: number[] = [];
  for (const [messageId, message] of (SillyTavern.chat ?? []).entries()) {
    if (message?.is_user) continue;
    const text = activeMessageText(message);
    if (text?.includes('<StatusPlaceHolderImpl/>')) result.push(messageId);
  }
  return result;
}

/**
 * 显示范围按“含托管状态栏的 AI 楼层”计数，不使用稀疏 messageId 差值。
 * 用户指定楼层是唯一额外例外，不会批量激活其他历史 iframe。
 */
export function activeStatusbarMessageIds(
  managed: readonly number[],
  selectedMessageId: number | null,
  range: number,
): Set<number> {
  const active = new Set(managed.slice(Math.max(0, managed.length - range)));
  if (selectedMessageId !== null) active.add(selectedMessageId);
  return active;
}

/** 来源必须逐字段相等，否则写入不得回退到当前最新楼。 */
export function sourceMatches(left: ComparableSource, right: ComparableSource): boolean {
  return (
    left.kind === right.kind &&
    left.pageEpoch === right.pageEpoch &&
    left.instanceId === right.instanceId &&
    left.characterId === right.characterId &&
    left.groupId === right.groupId &&
    left.chatId === right.chatId &&
    left.messageId === right.messageId &&
    left.mk === right.mk &&
    left.swipeId === right.swipeId &&
    left.iframeName === right.iframeName
  );
}

/**
 * 记住惰性宏的原始模板文本，以便后续 revision 只原地更新节点。
 * 绑定不触发 HTML 重建，否则会再次执行作者脚本。
 */
export function collectMacroBindings(root: ParentNode): MacroBinding[] {
  const bindings: MacroBinding[] = [];
  const visit = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const source = node.nodeValue ?? '';
      const normalized = normalizeStatusbarMacroBindingSource(source);
      if (normalized !== null) bindings.push({ kind: 'text', node: node as Text, source: normalized });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      for (const child of [...node.childNodes]) visit(child);
      return;
    }
    const element = node as Element;
    if (['SCRIPT', 'STYLE', 'TEXTAREA', 'IFRAME', 'TEMPLATE'].includes(element.tagName)) return;
    for (const attribute of [...element.attributes]) {
      const normalized = normalizeStatusbarMacroBindingSource(attribute.value);
      if (normalized !== null) bindings.push({ kind: 'attribute', element, name: attribute.name, source: normalized });
    }
    for (const child of [...node.childNodes]) visit(child);
  };
  visit(root);
  return bindings;
}

/** 已绑定节点只原地更新值，绝不替换消息或 iframe。 */
export function updateMacroBindings(instance: MacroBindingHost): void {
  if (instance.state === null) return;
  const snapshot = createEraMacroSnapshotFromPublicState(instance.state);
  for (const binding of instance.macroBindings) {
    const value = resolveEraLazyMacroTokens(binding.source, snapshot);
    if (binding.kind === 'text') binding.node.nodeValue = value;
    else binding.element.setAttribute(binding.name, value);
  }
}
