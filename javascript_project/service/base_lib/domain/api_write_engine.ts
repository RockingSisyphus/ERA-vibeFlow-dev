/**
 * ERA 九个公开写入 API 的纯适配引擎。
 *
 * 本模块只把公开 detail 转换为候选格式的 Variable 指令块，并在只读消息快照中
 * 选择最后一条 AI 消息、构造单次消息更新请求。它不访问 Tavern、时间、随机数或
 * Capability，也不会修改输入消息及其附件字段。
 */

import {
  cloneMkValue,
  parseMessageKeyData,
} from "./mk_engine.ts";

export type EraApiWriteEventV1 =
  | "era:insertByObject"
  | "era:updateByObject"
  | "era:insertByPath"
  | "era:updateByPath"
  | "era:deleteByObject"
  | "era:deleteByPath"
  | "era:functionInsertByObject"
  | "era:functionEditByObject"
  | "era:functionDeleteByObject";

export type EraApiWriteBlockTagV1 =
  | "VariableInsert"
  | "VariableEdit"
  | "VariableDelete"
  | "FunctionInsert"
  | "FunctionEdit"
  | "FunctionDelete";

export interface EraApiWriteDirectiveV1 {
  readonly eventType: EraApiWriteEventV1;
  readonly blockTag: EraApiWriteBlockTagV1;
  readonly blockContent: Readonly<Record<string, unknown>>;
  readonly block: string;
}

export interface EraApiMessageAppendPlanV1 {
  readonly kind: "append-message-command";
  readonly messageId: number;
  readonly originalContent: string;
  readonly newContent: string;
  readonly update: Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function defineOwn(
  target: Record<string, unknown> | unknown[],
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function requireObjectDetail(value: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new TypeError("ERA API 事件需要对象形式的 detail。");
  }
  return value;
}

function toPath(value: unknown): string[] {
  const path = String(value);
  const parts: string[] = [];
  if (path.startsWith(".")) parts.push("");
  // RegExp 保持为调用内局部值，避免 global lastIndex 成为跨调用模块状态。
  const pathPart = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]/g;
  path.replace(pathPart, (match, numeric, quote, quoted) => {
    parts.push(
      quote
        ? String(quoted).replace(/\\(\\)?/g, "$1")
        : String(numeric ?? match),
    );
    return match;
  });
  if (parts.length === 0) parts.push(path);
  return parts;
}

function isArrayIndex(value: string): boolean {
  return /^(?:0|[1-9]\d*)$/.test(value) && Number(value) < 4_294_967_295;
}

function setPath(path: unknown, value: unknown): Record<string, unknown> {
  const parts = toPath(path);
  const result: Record<string, unknown> = {};
  let cursor: Record<string, unknown> | unknown[] = result;
  for (let index = 0; index < parts.length; index += 1) {
    const key = parts[index] ?? "";
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      // lodash 4.18 同样阻止这些原型链写入；显式失败比静默污染宿主更可审计。
      throw new TypeError(`ERA API 路径包含不允许的段：${key}`);
    }
    if (index === parts.length - 1) {
      defineOwn(cursor, key, cloneMkValue(value));
      continue;
    }
    const child: Record<string, unknown> | unknown[] = isArrayIndex(
      parts[index + 1] ?? "",
    )
      ? []
      : {};
    defineOwn(cursor, key, child);
    cursor = child;
  }
  return result;
}

function blockTag(eventType: EraApiWriteEventV1): EraApiWriteBlockTagV1 {
  if (eventType === "era:functionInsertByObject") return "FunctionInsert";
  if (eventType === "era:functionEditByObject") return "FunctionEdit";
  if (eventType === "era:functionDeleteByObject") return "FunctionDelete";
  if (eventType === "era:insertByObject" || eventType === "era:insertByPath")
    return "VariableInsert";
  if (eventType === "era:updateByObject" || eventType === "era:updateByPath")
    return "VariableEdit";
  return "VariableDelete";
}

function isPathEvent(eventType: EraApiWriteEventV1): boolean {
  return eventType.endsWith("ByPath");
}

function isDeleteEvent(eventType: EraApiWriteEventV1): boolean {
  return eventType === "era:deleteByObject" || eventType === "era:deleteByPath";
}

export function isEraApiWriteEvent(value: string): value is EraApiWriteEventV1 {
  return (
    value === "era:insertByObject" ||
    value === "era:updateByObject" ||
    value === "era:insertByPath" ||
    value === "era:updateByPath" ||
    value === "era:deleteByObject" ||
    value === "era:deleteByPath" ||
    value === "era:functionInsertByObject" ||
    value === "era:functionEditByObject" ||
    value === "era:functionDeleteByObject"
  );
}

/** 将公开 API detail 转成候选的两空格 JSON 指令块。 */
export function prepareApiWriteDirective(
  eventType: string,
  detail: unknown,
): EraApiWriteDirectiveV1 {
  if (!isEraApiWriteEvent(eventType)) {
    throw new TypeError(`不是已登记的 ERA 写入 API：${eventType}`);
  }
  const objectDetail = requireObjectDetail(detail);
  const content = isPathEvent(eventType)
    ? setPath(
        objectDetail.path,
        isDeleteEvent(eventType) ? {} : objectDetail.value,
      )
    : (cloneMkValue(objectDetail) as Record<string, unknown>);
  const tag = blockTag(eventType);
  let encoded: string;
  try {
    encoded = JSON.stringify(content, null, 2);
  } catch (error) {
    encoded = `<<stringify失败: ${error instanceof Error ? error.message : String(error)}>>`;
  }
  return {
    eventType,
    blockTag: tag,
    blockContent: cloneMkValue(content),
    block: `\n<${tag}>\n${encoded}\n</${tag}>`,
  };
}

/** 为九个显式图分支构造拥有唯一 provider key 的节点输出。 */
export function prepareApiWriteNodeResult(
  request: unknown,
  expectedEvent: EraApiWriteEventV1,
  outputKey: string,
): Readonly<Record<string, unknown>> {
  if (!isRecord(request) || !isRecord(request.task)) {
    throw new TypeError("写入请求缺少完整 API task。");
  }
  const eventType = String(request.task.eventType ?? "");
  if (eventType !== expectedEvent) {
    throw new TypeError(`写入分支期望 ${expectedEvent}，实际收到 ${eventType}。`);
  }
  return {
    [outputKey]: {
      request,
      directive: prepareApiWriteDirective(expectedEvent, request.detail),
    },
  };
}

function unwrapMessages(value: unknown, depth = 0): readonly unknown[] {
  if (Array.isArray(value)) return value;
  if (!isRecord(value) || depth > 5) {
    throw new TypeError("消息读取结果没有 messages 数组。");
  }
  for (const key of ["messages", "chat", "value", "context", "data"]) {
    const nested = value[key];
    if (Array.isArray(nested)) return nested;
    if (isRecord(nested)) {
      try {
        return unwrapMessages(nested, depth + 1);
      } catch {
        // 尝试下一个兼容包装层。
      }
    }
  }
  if (Object.keys(value).length === 0) return [];
  throw new TypeError("消息读取结果没有 messages 数组。");
}

function messageId(message: Readonly<Record<string, unknown>>): number | null {
  const raw = message.messageId;
  return Number.isSafeInteger(raw) && Number(raw) >= 0 ? Number(raw) : null;
}

function activeContent(message: Readonly<Record<string, unknown>>): string | null {
  return typeof message.activeText === "string" ? message.activeText : null;
}

function isUserMessage(message: Readonly<Record<string, unknown>>): boolean {
  const parsed = parseMessageKeyData(activeContent(message));
  if (parsed !== null) return parsed.messageType === "user";
  return message.role === "user";
}

function updatePayload(
  _message: Readonly<Record<string, unknown>>,
  id: number,
  newContent: string,
): Readonly<Record<string, unknown>> {
  return { messageId: id, content: newContent };
}

/**
 * 在只读消息快照中选择最后一条非 user 消息并构造局部更新；未知字段和附件不进入
 * 替换对象，因此 Host 的 setChatMessages 局部写入会原样保留它们。
 */
export function planApiMessageAppend(
  rawMessages: unknown,
  directive: EraApiWriteDirectiveV1,
): EraApiMessageAppendPlanV1 {
  const messages = unwrapMessages(rawMessages);
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const raw = messages[index];
    if (!isRecord(raw) || raw.schemaVersion !== 1 || isUserMessage(raw)) continue;
    const id = messageId(raw);
    if (id === null) continue;
    const originalContent = activeContent(raw) ?? "";
    const newContent = originalContent + directive.block;
    return {
      kind: "append-message-command",
      messageId: id,
      originalContent,
      newContent,
      update: updatePayload(raw, id, newContent),
    };
  }
  throw new Error("找不到任何 AI 消息，无法执行 API 写入。");
}
