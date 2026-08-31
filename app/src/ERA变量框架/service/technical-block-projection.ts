/*
 * 模块职责：为消息显示与模型提示提供同一套 ERA 技术块识别和纯投影。
 * 模块边界：只改变渲染 DOM 或 GENERATE_AFTER_DATA 的临时出站副本；
 * 不写聊天消息、Sidecar，也不参与历史同步和 Agent 领域状态机。
 */

const FOLDED_TAG_LABELS = Object.freeze({
  era_plan: 'ERA 规划报告',
  era_update: 'ERA 变量解析报告',
  era_agent_error: 'ERA 多阶段生成错误',
});

const HIDDEN_TAG_NAMES = Object.freeze([
  'era_tx',
  'variableinsert',
  'variableedit',
  'variabledelete',
  'functioninsert',
  'functionedit',
  'functiondelete',
  'era_data',
  'variablethink',
]);

const ALL_TAG_NAMES = Object.freeze([...Object.keys(FOLDED_TAG_LABELS), ...HIDDEN_TAG_NAMES]);
const TAG_PATTERN = ALL_TAG_NAMES.join('|');
const TECHNICAL_TAG_TOKEN = new RegExp(`<\\s*(\\/?)\\s*(${TAG_PATTERN})\\b[^>]*>`, 'giu');
const DISPLAY_PROJECTION_VERSION = 'era-technical-projection-v1';

type TechnicalBlockKind = 'folded' | 'hidden';
type OpenTag = {
  readonly name: string;
  readonly start: number;
  readonly contentStart: number;
  readonly kind: TechnicalBlockKind;
};

export type EraTechnicalSegment =
  | { readonly kind: 'story'; readonly text: string }
  | {
      readonly kind: TechnicalBlockKind;
      readonly name: string;
      readonly label?: string;
      readonly text: string;
      readonly source: string;
    };

/** 描述一次保守解析的有效性、技术块数量和按原文顺序排列的显示片段。 */
export type EraTechnicalProjection = {
  readonly valid: boolean;
  readonly technicalBlockCount: number;
  readonly segments: readonly EraTechnicalSegment[];
};

type ClosedBlock = OpenTag & { readonly end: number; readonly contentEnd: number };

function technicalBlockKind(name: string): TechnicalBlockKind {
  return Object.hasOwn(FOLDED_TAG_LABELS, name) ? 'folded' : 'hidden';
}

/**
 * 只收集严格闭合的顶层块，内层变量命令由外层事务统一承载。
 * 返回 null 表示边界不可信，调用方必须保留整段原文。
 */
function collectTechnicalBlocks(text: string): ClosedBlock[] | null {
  const stack: OpenTag[] = [];
  const blocks: ClosedBlock[] = [];
  TECHNICAL_TAG_TOKEN.lastIndex = 0;
  for (let match = TECHNICAL_TAG_TOKEN.exec(text); match; match = TECHNICAL_TAG_TOKEN.exec(text)) {
    const closing = match[1] === '/';
    const name = match[2].toLowerCase();
    if (!closing) {
      stack.push({
        name,
        kind: technicalBlockKind(name),
        start: match.index,
        contentStart: match.index + match[0].length,
      });
      continue;
    }

    const open = stack.at(-1);
    if (!open || open.name !== name) return null;
    stack.pop();
    if (stack.length === 0) {
      blocks.push({ ...open, contentEnd: match.index, end: match.index + match[0].length });
    }
  }
  return stack.length === 0 ? blocks : null;
}

/**
 * 从权威消息原文解析严格配对的顶层 ERA 技术块。任意错序、孤立结束标签或未闭合标签
 * 都会让整次解析失效；必须宁可保留原文，也不冒险吞掉故事或伪造报告边界。
 */
export function parseEraTechnicalProjection(text: string): EraTechnicalProjection {
  const blocks = collectTechnicalBlocks(text);
  if (blocks === null) {
    return { valid: false, technicalBlockCount: 0, segments: [{ kind: 'story', text }] };
  }
  if (blocks.length === 0) {
    return { valid: true, technicalBlockCount: 0, segments: [{ kind: 'story', text }] };
  }

  const segments: EraTechnicalSegment[] = [];
  let cursor = 0;
  for (const block of blocks) {
    if (block.start > cursor) segments.push({ kind: 'story', text: text.slice(cursor, block.start) });
    segments.push({
      kind: block.kind,
      name: block.name,
      label: FOLDED_TAG_LABELS[block.name as keyof typeof FOLDED_TAG_LABELS],
      text: text.slice(block.contentStart, block.contentEnd),
      source: text.slice(block.start, block.end),
    });
    cursor = block.end;
  }
  if (cursor < text.length) segments.push({ kind: 'story', text: text.slice(cursor) });
  return { valid: true, technicalBlockCount: blocks.length, segments };
}

/**
 * 只删除严格配对的保留标签。错序或缺失结束标签会保留原文，避免把故事吞到后续偶然出现的闭合标签。
 */
export function stripEraTechnicalBlocks(text: string): string {
  const projection = parseEraTechnicalProjection(text);
  if (!projection.valid || projection.technicalBlockCount === 0) return text;
  return projection.segments
    .filter((segment): segment is Extract<EraTechnicalSegment, { kind: 'story' }> => segment.kind === 'story')
    .map(segment => segment.text)
    .join('');
}

/**
 * 复制出站消息及多模态文本项，避免提示清理反向改写聊天历史；图片、工具调用与其他字段保持原值。
 */
export function projectEraPromptMessages(
  messages: readonly SillyTavern.SendingMessage[],
): SillyTavern.SendingMessage[] {
  return messages.map(message => {
    const content = message.content;
    if (typeof content === 'string') return { ...message, content: stripEraTechnicalBlocks(content) };
    if (!Array.isArray(content)) return { ...message };
    return {
      ...message,
      content: content.map(item =>
        item.type === 'text' ? { ...item, text: stripEraTechnicalBlocks(item.text) } : item,
      ),
    };
  });
}

function sourceFingerprint(text: string): string {
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
  const content = hostDocument.createElement('pre');
  content.textContent = segment.text;
  details.append(summary, content);
  return details;
}

function currentRawMessage(messageId: number): string | null {
  const message = SillyTavern.chat?.[messageId];
  return typeof message?.mes === 'string' ? message.mes : null;
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
function projectDisplayedMessage(messageId: number): void {
  const rawMessage = currentRawMessage(messageId);
  if (rawMessage === null) return;
  const projection = parseEraTechnicalProjection(rawMessage);
  if (!projection.valid || projection.technicalBlockCount === 0) return;

  const root = retrieveDisplayedMessage(messageId).get(0);
  if (!root) return;
  if (isDisplayedMessageBeingEdited(root)) return;
  const fingerprint = sourceFingerprint(rawMessage);
  if (
    root.dataset.eraProjectionVersion === DISPLAY_PROJECTION_VERSION &&
    root.dataset.eraProjectionSource === fingerprint &&
    root.querySelector(`[data-era-projection-version="${DISPLAY_PROJECTION_VERSION}"]`)
  ) {
    return;
  }

  const hostDocument = root.ownerDocument;
  const fragment = hostDocument.createDocumentFragment();
  for (const segment of projection.segments) {
    if (segment.kind === 'story') appendFormattedStory(hostDocument, fragment, segment.text, messageId);
    else fragment.append(createProjectedBlock(hostDocument, segment));
  }
  root.replaceChildren(fragment);
  root.dataset.eraProjectionVersion = DISPLAY_PROJECTION_VERSION;
  root.dataset.eraProjectionSource = fingerprint;
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
  `;
  hostDocument.head.append(style);

  const scheduler = createProjectionScheduler();

  scheduler.scheduleAllMessages();
  const observer = new HostMutationObserver(records => {
    for (const messageId of mutationMessageIds(records)) scheduler.scheduleMessage(messageId);
  });
  observer.observe(hostDocument.documentElement, { childList: true, subtree: true });

  const messageHandler = (messageId: number) => scheduler.scheduleMessage(messageId);
  const allMessagesHandler = () => scheduler.scheduleAllMessages();
  const displayEvents = [
    tavern_events.USER_MESSAGE_RENDERED,
    tavern_events.CHARACTER_MESSAGE_RENDERED,
    tavern_events.MESSAGE_UPDATED,
    tavern_events.MESSAGE_SWIPED,
  ];
  for (const eventType of displayEvents) eventMakeLast(eventType, messageHandler);
  eventMakeLast(tavern_events.MORE_MESSAGES_LOADED, allMessagesHandler);
  eventMakeLast(tavern_events.CHAT_CHANGED, allMessagesHandler);

  const promptHandler = (generateData: { prompt: SillyTavern.SendingMessage[] }) => {
    if (Array.isArray(generateData.prompt)) generateData.prompt = projectEraPromptMessages(generateData.prompt);
  };
  eventMakeLast(tavern_events.GENERATE_AFTER_DATA, promptHandler);

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    for (const eventType of displayEvents) eventRemoveListener(eventType, messageHandler);
    eventRemoveListener(tavern_events.MORE_MESSAGES_LOADED, allMessagesHandler);
    eventRemoveListener(tavern_events.CHAT_CHANGED, allMessagesHandler);
    eventRemoveListener(tavern_events.GENERATE_AFTER_DATA, promptHandler);
    scheduler.clear();
    style.remove();
  };
}
