/*
 * 在酒馆排版前清理显示副本，在正文旁挂载 ERA 报告，并投影发往模型的文本。
 * 由 Tavern 启用节点成对管理资源；聊天原文、酒馆正文及作者 iframe 由原有入口管理。
 */

import { TavernListeners } from './tavern-listeners';
import { createEraMacroSnapshot } from '../macro/registration';
import type { EraMacroSnapshot } from '../macro/syntax';
import { runEraMacroWorkflow } from '../macro/vibeflow-adapter';
import { currentTavernIdentityMatches } from './public-state';
import { readActiveSidecarRuntimeSnapshot } from './sidecar-runtime-snapshot';
import { agentExecutionRecords, currentAgentRecordChat } from './agent-execution-records';
import { registerAgentRequestObservation } from './agent-report-host';
import { createReportPresentation } from './technical-report-presentation';
import { stripEraTechnicalBlocks } from './technical-block-syntax';

const reportStyles = `
    .era-technical-report {
      margin: .45rem 0;
      padding: .35rem .55rem;
      border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
      border-radius: .65rem;
      background: color-mix(in srgb, currentColor 5%, transparent);
      font-size: .88em;
    }
    .era-technical-report > summary { cursor: pointer; user-select: none; opacity: .8; }
    .era-technical-report > :not(summary) { margin: .45rem 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    .era-stage-toolbar { display: flex; flex-wrap: wrap; gap: .35rem; margin: .4rem 0; }
    .era-stage-toolbar button, .era-stage-toolbar select { color: inherit; background: transparent; border: 1px solid currentColor; border-radius: .4rem; padding: .3rem .5rem; }
    .era-stage-toolbar button:disabled { opacity: .5; }
    .era-stage-viewer pre { white-space: pre-wrap; max-height: 28rem; overflow: auto; }
  `;

const formatterOwnerKey = Symbol.for('ERA.messageFormatter.presentation');
type TavernWindow = Window & { readonly SillyTavern?: typeof SillyTavern };
type FormatterSlot = { release?: () => void; display?: (text: string) => string };

/** 酒馆 1.19 没有单个 hook 的注销接口，页内只登记一次，卸载时解除本实例回调。 */
function formatterSlot(host: TavernWindow): FormatterSlot {
  const existing = Reflect.get(host, formatterOwnerKey) as FormatterSlot | undefined;
  if (existing) return existing;
  const formatter = host.SillyTavern?.getContext?.().messageFormatter;
  if (!formatter) throw new Error('ERA 技术内容显示需要 SillyTavern 1.19.0 或更新版本的 MessageFormatter。');
  const slot: FormatterSlot = {};
  formatter.addHook((text, context) => (context.isReasoning ? text : (slot.display?.(text) ?? text)), {
    stage: formatter.stage.BEFORE_REGEX,
  });
  Reflect.set(host, formatterOwnerKey, slot);
  return slot;
}

/**
 * 复制出站消息及多模态文本项，避免提示清理反向改写聊天历史；图片、工具调用与其他字段保持原值。
 */
export function projectEraPromptMessages(
  messages: readonly SillyTavern.SendingMessage[],
  macroSnapshot?: EraMacroSnapshot,
): SillyTavern.SendingMessage[] {
  const projectText = (text: string) => {
    return runEraMacroWorkflow(
      text,
      macroSnapshot ? { kind: 'view', mode: 'prompt', ...macroSnapshot } : { kind: 'projection-only' },
    );
  };
  return messages.map(message => {
    const content = message.content;
    if (typeof content === 'string') return { ...message, content: projectText(content) };
    if (!Array.isArray(content)) return { ...message };
    return {
      ...message,
      content: content.map(item => (item.type === 'text' ? { ...item, text: projectText(item.text) } : item)),
    };
  });
}

const statefulDisplay = 'pre, iframe, audio, video, canvas, form, input, button, select, textarea';

/** 原生恢复先排版后启动角色卡脚本。补做已显示的正文时只替换前端界面之间的内容。 */
function projectExistingBody(body: HTMLElement, rendered: DocumentFragment): void {
  const partition = (parent: ParentNode) => {
    const anchors: { element: Element; kind: string }[] = [];
    const paragraphs: ChildNode[][] = [[]];
    for (const node of parent.childNodes) {
      const element = node.nodeType === 1 ? (node as Element) : null;
      const stateful = element?.matches(statefulDisplay) ? element : element?.querySelector(statefulDisplay);
      if (element && stateful) {
        // Helper 把原生 pre 包在呈现容器中。容器和文件内容仍由 Helper 管理。
        anchors.push({ element, kind: stateful.tagName });
        paragraphs.push([]);
      } else paragraphs.at(-1)!.push(node);
    }
    return { anchors, paragraphs };
  };
  const before = partition(body);
  const after = partition(rendered);
  // 两边的界面位置不对应时，逐段替换可能把正文移到错误的作者控件旁。
  if (
    before.anchors.length !== after.anchors.length ||
    before.anchors.some(({ kind }, index) => kind !== after.anchors[index].kind)
  )
    return;
  for (const [index, current] of before.paragraphs.entries()) {
    const projected = after.paragraphs[index];
    if (current.length === projected.length && current.every((node, i) => node.isEqualNode(projected[i]))) continue;
    const fragment = body.ownerDocument.createDocumentFragment();
    fragment.append(...projected);
    body.insertBefore(fragment, before.anchors[index]?.element ?? null);
    for (const node of current) node.remove();
  }
}

/** 恢复旧聊天时原生排版先发生，已在屏幕上的正文需补做一次显示投影。 */
function projectMessagesAlreadyOnScreen(document: Document): void {
  for (const row of document.querySelectorAll<HTMLElement>('#chat > .mes[mesid]')) {
    const messageId = Number(row.getAttribute('mesid'));
    const message = SillyTavern.chat[messageId];
    const body = row.querySelector<HTMLElement>('.mes_text');
    if (!message || !body) continue;
    const text = message.extra?.display_text ?? message.mes;
    const projected = stripEraTechnicalBlocks(text);
    if (projected === text) continue;
    const template = document.createElement('template');
    template.innerHTML = SillyTavern.messageFormatting(
      projected,
      message.name,
      message.is_system,
      message.is_user,
      messageId,
    );
    projectExistingBody(body, template.content);
  }
}

function displayedMessageId(node: Node): number | null {
  const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
  const message = element?.closest<HTMLElement>('.mes[mesid]');
  const rawId = message?.getAttribute('mesid');
  if (rawId === null || rawId === undefined || !/^\d+$/u.test(rawId)) return null;
  return Number(rawId);
}

function descendantMessageIds(element: Element): number[] {
  return [...element.querySelectorAll<HTMLElement>('.mes[mesid]')]
    .map(message => message.getAttribute('mesid'))
    .filter((rawId): rawId is string => rawId !== null && /^\d+$/u.test(rawId))
    .map(Number);
}

/** 从一批 DOM 变化中去重提取受影响楼层，避免全量扫描和投影后的自触发风暴。 */
function mutationMessageIds(records: readonly MutationRecord[]): Set<number> {
  const messageIds = new Set<number>();
  const addNode = (node: Node): void => {
    const directId = displayedMessageId(node);
    if (directId !== null) messageIds.add(directId);
    if (node.nodeType === 1) {
      for (const messageId of descendantMessageIds(node as Element)) messageIds.add(messageId);
    }
  };
  for (const record of records) {
    addNode(record.target);
    for (const added of record.addedNodes) addNode(added);
  }
  return messageIds;
}

type ProjectionScheduler = {
  readonly scheduleMessage: (messageId: number) => void;
  readonly scheduleAllMessages: () => void;
  readonly clear: () => void;
};

/** 合并同一轮 DOM 变化，避免宿主一次渲染触发多次同楼报告更新。 */
function createProjectionScheduler(refresh: (messageId: number) => void): ProjectionScheduler {
  const pending = new Set<number>();
  let flushScheduled = false;
  let released = false;
  const scheduleMessage = (messageId: number): void => {
    if (released || !Number.isSafeInteger(messageId) || messageId < 0) return;
    pending.add(messageId);
    if (flushScheduled) return;
    flushScheduled = true;
    queueMicrotask(() => {
      flushScheduled = false;
      const messageIds = [...pending];
      pending.clear();
      for (const id of messageIds) refresh(id);
    });
  };
  return {
    scheduleMessage,
    scheduleAllMessages: () => {
      for (let messageId = 0; messageId < (SillyTavern.chat?.length ?? 0); messageId += 1) {
        scheduleMessage(messageId);
      }
    },
    clear: () => {
      released = true;
      pending.clear();
    },
  };
}

/**
 * Tavern 启用时配对登记宿主排版和提示处理。热重载必须释放旧实例的资源，避免重复投影或重复响应消息事件。
 */
function mountTechnicalPresentation(): { scheduleMessage: (messageId: number) => void; release: () => void } {
  const host = window.parent as TavernWindow;
  const hostDocument = host.document;
  const slot = formatterSlot(host);
  slot.release?.();
  const HostMutationObserver = hostDocument.defaultView?.MutationObserver;
  if (!HostMutationObserver) throw new Error('ERA 报告无法监听酒馆楼层。');
  const style = hostDocument.createElement('style');
  style.dataset.eraTechnicalReportStyle = '';
  style.textContent = reportStyles;

  const reports = createReportPresentation();
  const scheduler = createProjectionScheduler(reports.refresh);

  const observer = new HostMutationObserver(records => {
    reports.releaseDetached();
    // 报告自身的 Vue 更新也会触发观察器，必须排除以免再次生成同一报告。
    const hostChanges = records.filter(record => !reports.ownsMutation(record.target));
    for (const messageId of mutationMessageIds(hostChanges)) scheduler.scheduleMessage(messageId);
  });

  const messageHandler = (messageId: number) => scheduler.scheduleMessage(messageId);
  const allMessagesHandler = () => scheduler.scheduleAllMessages();
  const displayEvents = [
    tavern_events.USER_MESSAGE_RENDERED,
    tavern_events.CHARACTER_MESSAGE_RENDERED,
    tavern_events.MESSAGE_UPDATED,
    tavern_events.MESSAGE_SWIPED,
  ];
  const promptHandler = (generateData: { prompt: SillyTavern.SendingMessage[] }, dryRun = false) => {
    if (!Array.isArray(generateData.prompt)) return;
    const snapshot = readActiveSidecarRuntimeSnapshot();
    // 切换聊天期间旧快照可能还在内存，确认归属才能把其中的变量带入提示词。
    const macroSnapshot = createEraMacroSnapshot(
      snapshot && currentTavernIdentityMatches(snapshot) ? snapshot.statData : {},
    );
    generateData.prompt = projectEraPromptMessages(generateData.prompt, macroSnapshot);
    agentExecutionRecords.capture(currentAgentRecordChat(), generateData.prompt, dryRun);
  };
  const listeners = new TavernListeners();
  let stopRequestObservation: (() => void) | undefined;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (slot.release === stop) {
      slot.display = undefined;
      slot.release = undefined;
    }
    observer.disconnect();
    listeners.release();
    stopRequestObservation?.();
    scheduler.clear();
    reports.release();
    style.remove();
  };
  try {
    slot.display = stripEraTechnicalBlocks;
    slot.release = stop;
    hostDocument.head.append(style);
    projectMessagesAlreadyOnScreen(hostDocument);
    observer.observe(hostDocument.documentElement, { childList: true, subtree: true });
    for (const eventType of displayEvents) listeners.register(eventType, messageHandler, 'last');
    listeners.register(tavern_events.MORE_MESSAGES_LOADED, allMessagesHandler, 'last');
    listeners.register(tavern_events.CHAT_CHANGED, allMessagesHandler, 'last');
    listeners.register(tavern_events.GENERATE_AFTER_DATA, promptHandler, 'last');
    stopRequestObservation = registerAgentRequestObservation();
    scheduler.scheduleAllMessages();
    return { scheduleMessage: scheduler.scheduleMessage, release: stop };
  } catch (error) {
    stop();
    throw error;
  }
}

/** Tavern 启用节点拥有展示资源，避免消息写回节点各自登记监听或接管楼层 DOM。 */
export function createEraTechnicalPresentation() {
  let mounted: ReturnType<typeof mountTechnicalPresentation> | undefined;
  return {
    activate: () => {
      mounted = mountTechnicalPresentation();
      const current = mounted;
      return () => {
        if (mounted === current) mounted = undefined;
        current.release();
      };
    },
    updateReports: (messageIds: readonly number[]) => {
      for (const messageId of messageIds) mounted?.scheduleMessage(messageId);
    },
  };
}
