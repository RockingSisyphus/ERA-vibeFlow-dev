/*
 * 模块职责：为消息显示与模型提示提供同一套 ERA 技术块识别和纯投影。
 * 模块边界：只改变渲染 DOM 或 GENERATE_AFTER_DATA 的临时出站副本；
 * 不写聊天消息、Sidecar，也不参与历史同步和 Agent 领域状态机。
 */

import { TavernListeners } from './tavern-listeners';
import { createEraMacroSnapshot } from '../macro/registration';
import type { EraMacroSnapshot } from '../macro/syntax';
import { runEraMacroWorkflow } from '../macro/vibeflow-adapter';
import { currentTavernIdentityMatches } from './public-state';
import { readActiveSidecarRuntimeSnapshot } from './sidecar-runtime-snapshot';
import { agentExecutionRecords, currentAgentRecordChat } from './agent-execution-records';
import {
  mountReportViewer,
  releaseReportApps,
  createStoryViewer,
  createSettlementViewer,
  registerAgentRequestObservation,
  hydrateReportViewers,
} from './agent-report-host';

import {
  parseEraTechnicalProjection,
  stripEraTechnicalBlocks,
  type EraTechnicalProjection,
  type EraTechnicalSegment,
} from './technical-block-syntax';
export { parseEraTechnicalProjection, stripEraTechnicalBlocks } from './technical-block-syntax';
export type { EraTechnicalProjection, EraTechnicalSegment } from './technical-block-syntax';

const DISPLAY_PROJECTION_VERSION = 'era-technical-projection-v2';
const projectedStories = new WeakMap<HTMLElement, string>();

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

/**
 * 显示失效只取决于可见正文和报告，不取决于隐藏的业务日志。
 * API 的 refresh:none 会追加 era_tx；若仍以完整原文判定失效，随后任意
 * DOM mutation 都会意外重建消息和作者 iframe，必须避免这种隐式刷新。
 * 纯技术块之间的空白没有显示内容。
 */
export function eraTechnicalDisplaySource(projection: EraTechnicalProjection): string {
  const visible = projection.segments.filter(
    segment => segment.kind === 'folded' || (segment.kind === 'story' && segment.text.trim() !== ''),
  );
  const text = JSON.stringify(
    visible.map((segment, index) => {
      if (segment.kind !== 'story') return [segment.kind, segment.name, segment.text];
      // 末尾隐藏 MK/事务前追加的换行只是技术分隔符，不是正文变化。
      // 仅规范末个可见片段的行尾；正文内部换行、空格和报告边界仍参与比较。
      const story = index === visible.length - 1 ? segment.text.replace(/[\r\n]+$/u, '') : segment.text;
      return ['story', story];
    }),
  );
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${text.length}-${(hash >>> 0).toString(16)}`;
}

function appendFormattedStory(
  hostDocument: Document,
  fragment: DocumentFragment,
  text: string,
  messageId: number,
): void {
  if (text.length === 0) return;
  const template = hostDocument.createElement('template');
  template.innerHTML = formatAsDisplayedMessage(text, { message_id: messageId });
  fragment.append(template.content);
}

function createProjectedBlock(
  hostDocument: Document,
  segment: Exclude<EraTechnicalSegment, { kind: 'story' }>,
  messageId: number,
): HTMLElement {
  if (segment.kind === 'hidden') {
    const hidden = hostDocument.createElement('span');
    hidden.dataset.eraProjectionVersion = DISPLAY_PROJECTION_VERSION;
    hidden.dataset.eraTechnicalBlock = segment.name;
    hidden.hidden = true;
    hidden.setAttribute('aria-hidden', 'true');
    hidden.textContent = segment.source;
    return hidden;
  }

  const details = hostDocument.createElement('details');
  details.className = 'era-technical-report';
  details.dataset.eraProjectionVersion = DISPLAY_PROJECTION_VERSION;
  details.dataset.eraTechnicalBlock = segment.name;
  const summary = hostDocument.createElement('summary');
  summary.textContent = segment.label ?? 'ERA 技术报告';
  const stage = segment.name === 'era_update' ? 'settlement' : 'planning';
  summary.id = `era-report-summary-${stage}-${messageId}`;
  details.append(summary, mountReportViewer(hostDocument, segment.text, stage, messageId));
  return details;
}

function currentRawMessage(messageId: number): string | null {
  const message = SillyTavern.chat?.[messageId];
  return typeof message?.mes === 'string' ? message.mes : null;
}

function announceProjectedMessageRendered(messageId: number): void {
  const message = SillyTavern.chat?.[messageId];
  if (!message || typeof eventEmit !== 'function') return;
  // Tavern Helper 只会在宿主的 rendered 生命周期中把 html code block 挂成
  // message iframe。ERA 替换 `.mes_text` 后必须补回同一个正式生命周期事件；
  // dataset 指纹已经在触发前写入，因此 ERA 自己的末位监听不会重复投影。
  const emitted = message.is_user
    ? eventEmit(tavern_events.USER_MESSAGE_RENDERED, messageId)
    : eventEmit(tavern_events.CHARACTER_MESSAGE_RENDERED, messageId, 'era-technical-projection');
  void emitted.catch(error => console.error(`ERA 消息 #${messageId} 投影后的宿主渲染事件失败。`, error));
}

/**
 * SillyTavern 会把消息编辑器挂在现有楼层 DOM 内。编辑期间替换 `.mes_text`
 * 会移除宿主 textarea，并留下仍然可见的确认/取消按钮。显示投影因此必须把
 * 编辑器视为宿主所有的临时状态，等 MESSAGE_UPDATED 或后续 DOM 变化再重建。
 */
export function isDisplayedMessageBeingEdited(root: Element): boolean {
  const message = root.closest('.mes[mesid]');
  return Boolean(
    root.matches('#curEditTextarea, .edit_textarea') ||
    root.querySelector('#curEditTextarea, .edit_textarea') ||
    message?.querySelector('#curEditTextarea, .edit_textarea'),
  );
}

/**
 * 从权威消息构造显示副本。必须先格式化普通故事、再用 textContent 创建报告，
 * 否则宿主正则会再次删除报告，或把模型报告当成任意 HTML 注入页面。
 */
function replaceReportsInPlace(
  root: HTMLElement,
  projection: EraTechnicalProjection,
  messageId: number,
  story: string,
): boolean {
  const document = root.ownerDocument;
  const folded = projection.segments.filter(
    (segment): segment is Exclude<EraTechnicalSegment, { kind: 'story' }> => segment.kind === 'folded',
  );
  const reports = [...root.querySelectorAll<HTMLElement>(':scope > details[data-era-technical-block]')];
  if (
    reports.length !== folded.length ||
    reports.some((report, index) => report.dataset.eraTechnicalBlock !== folded[index].name)
  )
    return false;
  reports.forEach((report, index) => {
    const replacement = createProjectedBlock(document, folded[index], messageId);
    if (report.hasAttribute('open')) replacement.setAttribute('open', '');
    report.replaceWith(replacement);
  });
  const previous = root.querySelector(':scope > [data-era-story-viewer]');
  const viewer = createStoryViewer(document, messageId, story);
  if (previous && viewer) previous.replaceWith(viewer);
  else if (viewer) root.append(viewer);
  const oldSettlement = root.querySelector(':scope > [data-era-settlement-viewer]');
  const settlement = createSettlementViewer(document, messageId);
  if (oldSettlement && settlement) oldSettlement.replaceWith(settlement);
  else if (settlement) root.append(settlement);
  else oldSettlement?.remove();
  releaseReportApps();
  return true;
}

/** 首次呈现才格式化故事；将宿主片段装配与是否刷新判断分开。 */
function displayedMessageFragment(
  document: Document,
  projection: EraTechnicalProjection,
  messageId: number,
  story: string,
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const segment of projection.segments) {
    if (segment.kind === 'story') appendFormattedStory(document, fragment, segment.text, messageId);
    else fragment.append(createProjectedBlock(document, segment, messageId));
  }
  const viewer = createStoryViewer(document, messageId, story);
  if (viewer) fragment.append(viewer);
  const settlement = createSettlementViewer(document, messageId);
  if (settlement) fragment.append(settlement);
  return fragment;
}

/** 只有故事本身变化才重建宿主显示，否则仅更新 ERA 自有报告节点。 */
function projectDisplayedMessage(messageId: number): void {
  const rawMessage = currentRawMessage(messageId);
  if (rawMessage === null) return;
  const projection = parseEraTechnicalProjection(rawMessage);
  if (!projection.valid || projection.technicalBlockCount === 0) return;

  const root = retrieveDisplayedMessage(messageId).get(0);
  if (!root) return;
  if (isDisplayedMessageBeingEdited(root)) return;
  hydrateReportViewers(root);
  const fingerprint = eraTechnicalDisplaySource(projection);
  if (
    root.dataset.eraProjectionVersion === DISPLAY_PROJECTION_VERSION &&
    root.dataset.eraProjectionSource === fingerprint &&
    root.querySelector(`[data-era-projection-version="${DISPLAY_PROJECTION_VERSION}"]`)
  ) {
    return;
  }

  const hostDocument = root.ownerDocument;
  const storySource = eraTechnicalDisplaySource({
    ...projection,
    segments: projection.segments.filter(segment => segment.kind === 'story'),
  });
  // 重新解析变量只改变 ERA 报告。保留 Tavern Helper 的故事节点与 iframe，
  // 不把查看器更新误变成作者加载脚本的第二次执行。
  if (
    projectedStories.get(root) === storySource &&
    replaceReportsInPlace(root, projection, messageId, stripEraTechnicalBlocks(rawMessage))
  ) {
    root.dataset.eraProjectionSource = fingerprint;
    return;
  }
  const fragment = displayedMessageFragment(hostDocument, projection, messageId, stripEraTechnicalBlocks(rawMessage));
  root.replaceChildren(fragment);
  root.dataset.eraProjectionVersion = DISPLAY_PROJECTION_VERSION;
  root.dataset.eraProjectionSource = fingerprint;
  projectedStories.set(root, storySource);
  announceProjectedMessageRendered(messageId);
}

/**
 * ERA 以 refresh=none 写回权威消息时，宿主不会重建该楼层 DOM；写入能力必须显式调用
 * 此投影入口，否则新加入的规划和结算报告只能存在于消息文件中而不会显示。
 */
export function refreshDisplayedEraTechnicalBlocks(messageIds: readonly number[]): void {
  if (typeof document === 'undefined') return;
  for (const messageId of new Set(messageIds)) projectDisplayedMessage(messageId);
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

/** 合并同一轮 DOM 变化，避免宿主一次渲染产生的多个 mutation 重复格式化同一楼层。 */
function createProjectionScheduler(): ProjectionScheduler {
  const pending = new Set<number>();
  let flushScheduled = false;
  const scheduleMessage = (messageId: number): void => {
    if (!Number.isSafeInteger(messageId) || messageId < 0) return;
    pending.add(messageId);
    if (flushScheduled) return;
    flushScheduled = true;
    queueMicrotask(() => {
      flushScheduled = false;
      const messageIds = [...pending];
      pending.clear();
      for (const id of messageIds) projectDisplayedMessage(id);
    });
  };
  return {
    scheduleMessage,
    scheduleAllMessages: () => {
      for (let messageId = 0; messageId < (SillyTavern.chat?.length ?? 0); messageId += 1) {
        scheduleMessage(messageId);
      }
    },
    clear: () => pending.clear(),
  };
}

/**
 * 随 Tavern adapter 生命周期登记显示投影和最后提示投影。返回幂等清理函数是为了热重载时
 * 不残留 observer、样式或重复监听；非浏览器合同测试环境直接返回空清理器。
 */
export function registerEraTechnicalBlockProjection(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const hostDocument = window.parent?.document ?? document;
  const HostMutationObserver = hostDocument.defaultView?.MutationObserver;
  if (!HostMutationObserver) return () => undefined;
  const style = hostDocument.createElement('style');
  style.dataset.eraProjectionVersion = DISPLAY_PROJECTION_VERSION;
  style.textContent = `
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

  const scheduler = createProjectionScheduler();

  const observer = new HostMutationObserver(records => {
    releaseReportApps();
    for (const messageId of mutationMessageIds(records)) scheduler.scheduleMessage(messageId);
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
    observer.disconnect();
    listeners.release();
    stopRequestObservation?.();
    scheduler.clear();
    releaseReportApps(true);
    style.remove();
  };
  try {
    hostDocument.head.append(style);
    observer.observe(hostDocument.documentElement, { childList: true, subtree: true });
    for (const eventType of displayEvents) listeners.register(eventType, messageHandler, 'last');
    listeners.register(tavern_events.MORE_MESSAGES_LOADED, allMessagesHandler, 'last');
    listeners.register(tavern_events.CHAT_CHANGED, allMessagesHandler, 'last');
    listeners.register(tavern_events.GENERATE_AFTER_DATA, promptHandler, 'last');
    stopRequestObservation = registerAgentRequestObservation();
    scheduler.scheduleAllMessages();
    return stop;
  } catch (error) {
    stop();
    throw error;
  }
}
