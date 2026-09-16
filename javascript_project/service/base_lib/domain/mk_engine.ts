/**
 * ERA 消息密钥（MK）的纯文本引擎。
 *
 * 时间与随机 token 必须由调用方显式注入。本模块只扫描和修改消息文本片段，
 * 不读取时间、随机数、Tavern 或 DOM，也不会修改附件对象。
 */

export type EraMkJsonPrimitive = string | number | boolean | null;
export type EraMkJsonValue =
  | EraMkJsonPrimitive
  | readonly EraMkJsonValue[]
  | { readonly [key: string]: EraMkJsonValue };

export interface EraMkTextContentV1 {
  readonly kind: "text";
  readonly text: string;
}

export interface EraMkMultimodalContentV1 {
  readonly kind: "multimodal";
  readonly parts: readonly Readonly<Record<string, unknown>>[];
}

export type EraMkContentV1 = EraMkTextContentV1 | EraMkMultimodalContentV1;

export interface EraMkMessageV1 {
  readonly messageId: number;
  readonly role: string;
  readonly content: EraMkContentV1;
  readonly [key: string]: unknown;
}

export interface EraMessageKeyDataV1 {
  readonly mk: string;
  readonly messageType: string;
}

export interface EraMkSeedV1 {
  readonly timestamp: number;
  readonly token: string;
}

export type EraEnsureMessageKeyResultV1 =
  | {
      readonly status: "existing" | "created";
      readonly mk: string;
      readonly isNew: boolean;
      readonly message: EraMkMessageV1;
      readonly textUpdate: null | {
        readonly kind: "update-message-content";
        readonly messageId: number;
        readonly content: EraMkContentV1;
      };
    }
  | {
      readonly status: "invalid" | "seed-required";
      readonly mk: null;
      readonly isNew: false;
      readonly message: EraMkMessageV1;
      readonly reason: string;
      readonly textUpdate: null;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
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

/** 深拷贝消息 JSON，并保留数组空洞及所有未知字段。 */
export function cloneMkValue<T>(value: T): T {
  if (Array.isArray(value)) {
    const result = new Array<unknown>(value.length);
    for (let index = 0; index < value.length; index += 1) {
      if (index in value) result[index] = cloneMkValue(value[index]);
    }
    return result as T;
  }
  if (isPlainRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      defineOwn(result, key, cloneMkValue(value[key]));
    }
    return result as T;
  }
  return value;
}

function textParts(content: EraMkContentV1): readonly string[] {
  if (content.kind === "text") return [content.text];
  const texts: string[] = [];
  for (const part of content.parts) {
    if (
      isRecord(part) &&
      part.type === "text" &&
      typeof part.text === "string"
    ) {
      texts.push(part.text);
    }
  }
  return texts;
}

/** 返回可供 CRUD 解析的消息文本；多文本片段按原顺序用换行连接。 */
export function readMkMessageText(message: EraMkMessageV1): string {
  return textParts(message.content).join("\n");
}

function eraDataBlockPattern(): RegExp {
  return /<era_data\b[^>]*>[\s\S]*?<\/era_data>/giu;
}

/**
 * 移除模型或旧消息夹带的全部成对 ERA 元数据块。
 * 畸形、未闭合标签保持原样，避免误删作者正文。
 */
export function stripEraDataBlocks(text: string): string {
  return text.replace(eraDataBlockPattern(), "");
}

/** 复刻候选的非标准等号对象解析；损坏或缺字段时返回 null。 */
export function parseMessageKeyData(
  messageContent: string | null | undefined,
): EraMessageKeyDataV1 | null {
  if (typeof messageContent !== "string") return null;
  for (const block of messageContent.matchAll(eraDataBlockPattern())) {
    const custom = block[0].match(
      /^<era_data\b[^>]*>([\s\S]*?)<\/era_data>$/iu,
    )?.[1];
    if (!custom) continue;
    const key = custom.match(/"era-message-key"\s*=\s*"(.*?)"/)?.[1];
    const messageType = custom.match(/"era-message-type"\s*=\s*"(.*?)"/)?.[1];
    if (key && messageType) return { mk: key, messageType };
  }
  return null;
}

/** 只扫描当前内容中的文本片段；不会从附件或其他消息变体继承 MK。 */
export function readMessageKeyData(
  message: EraMkMessageV1,
): EraMessageKeyDataV1 | null {
  for (const text of textParts(message.content)) {
    const parsed = parseMessageKeyData(text);
    if (parsed !== null) return parsed;
  }
  return null;
}

export function readMessageKey(message: EraMkMessageV1): string | null {
  return readMessageKeyData(message)?.mk ?? null;
}

/** 使用注入的候选 Date.now() 与 rnd() 等价输入生成稳定 MK。 */
export function generateMessageKey(seed: EraMkSeedV1): string {
  if (
    !Number.isSafeInteger(seed.timestamp) ||
    seed.timestamp < 0 ||
    !/^[a-z0-9]+$/.test(seed.token)
  ) {
    throw new TypeError(
      "MK seed 必须包含非负安全整数时间与小写 base36 token。",
    );
  }
  return `era_mk_${seed.timestamp}_${seed.token}`;
}

export function formatMessageKeyBlock(mk: string, role: string): string {
  if (!mk) throw new TypeError("MK 不能为空。");
  const messageType = role === "user" ? "user" : "assistant";
  return `<era_data>{"era-message-key"="${mk}","era-message-type"="${messageType}"}</era_data>`;
}

function replaceMessageContent(
  message: EraMkMessageV1,
  content: EraMkContentV1,
): EraMkMessageV1 {
  const result = cloneMkValue(message) as Record<string, unknown>;
  defineOwn(result, "content", cloneMkValue(content));
  return result as EraMkMessageV1;
}

function stripMessageEraDataBlocks(message: EraMkMessageV1): EraMkMessageV1 {
  if (message.content.kind === "text") {
    return replaceMessageContent(message, {
      kind: "text",
      text: stripEraDataBlocks(message.content.text),
    });
  }
  const parts = cloneMkValue(message.content.parts) as Record<
    string,
    unknown
  >[];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part?.type !== "text" || typeof part.text !== "string") continue;
    const next = cloneMkValue(part);
    defineOwn(next, "text", stripEraDataBlocks(part.text));
    parts[index] = next;
  }
  return replaceMessageContent(message, { kind: "multimodal", parts });
}

/** 按候选格式把 MK 块追加到最后一个文本片段；附件引用和值保持不变。 */
export function appendMessageKeyBlock(
  message: EraMkMessageV1,
  mk: string,
): EraMkMessageV1 {
  const block = formatMessageKeyBlock(mk, message.role);
  if (message.content.kind === "text") {
    return replaceMessageContent(message, {
      kind: "text",
      text: `${message.content.text}\n${block}`,
    });
  }

  const parts = cloneMkValue(message.content.parts) as Record<
    string,
    unknown
  >[];
  let target = -1;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (
      parts[index]?.type === "text" &&
      typeof parts[index]?.text === "string"
    ) {
      target = index;
      break;
    }
  }
  if (target === -1) {
    parts.push({ type: "text", text: `\n${block}` });
  } else {
    const part = cloneMkValue(parts[target]);
    defineOwn(part, "text", `${String(part.text)}\n${block}`);
    parts[target] = part;
  }
  return replaceMessageContent(message, { kind: "multimodal", parts });
}

function canonicalizeMessageKey(
  message: EraMkMessageV1,
  mk: string,
): EraMkMessageV1 {
  return appendMessageKeyBlock(stripMessageEraDataBlocks(message), mk);
}

function replaceFirstBlock(
  text: string,
  mk: string,
  role: string,
): string | null {
  const pattern = /<era_data>({.*?})<\/era_data>/;
  const match = text.match(pattern);
  if (!match || parseMessageKeyData(match[0]) === null) return null;
  return text.replace(pattern, formatMessageKeyBlock(mk, role));
}

/** 替换首个有效 MK 块；只触碰命中的文本 part，附件和其他 part 原样深拷贝。 */
export function replaceMessageKey(
  message: EraMkMessageV1,
  mk: string,
): EraMkMessageV1 {
  if (message.content.kind === "text") {
    const replacement = replaceFirstBlock(
      message.content.text,
      mk,
      message.role,
    );
    return replacement === null
      ? appendMessageKeyBlock(message, mk)
      : replaceMessageContent(message, { kind: "text", text: replacement });
  }
  const parts = cloneMkValue(message.content.parts) as Record<
    string,
    unknown
  >[];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part?.type !== "text" || typeof part.text !== "string") continue;
    const replacement = replaceFirstBlock(part.text, mk, message.role);
    if (replacement === null) continue;
    const next = cloneMkValue(part);
    defineOwn(next, "text", replacement);
    parts[index] = next;
    return replaceMessageContent(message, { kind: "multimodal", parts });
  }
  return appendMessageKeyBlock(message, mk);
}

/** 确保消息具有 MK；已有有效 MK 时不重写，缺失时必须提供 seed。 */
export function ensureMessageKey(
  message: EraMkMessageV1,
  seed?: EraMkSeedV1,
): EraEnsureMessageKeyResultV1 {
  const original = cloneMkValue(message);
  if (
    !Number.isSafeInteger(message.messageId) ||
    message.messageId < 0 ||
    typeof message.role !== "string" ||
    message.role.length === 0
  ) {
    return {
      status: "invalid",
      mk: null,
      isNew: false,
      message: original,
      reason: "消息缺少有效的 messageId 或 role。",
      textUpdate: null,
    };
  }
  const existing = readMessageKey(message);
  if (existing) {
    const canonical = formatMessageKeyBlock(existing, message.role);
    const messageText = readMkMessageText(message);
    const blocks = messageText.match(eraDataBlockPattern()) ?? [];
    const alreadyCanonical = blocks.length === 1 && blocks[0] === canonical;
    if (!alreadyCanonical) {
      const updated = canonicalizeMessageKey(message, existing);
      return {
        status: "existing",
        mk: existing,
        isNew: false,
        message: updated,
        textUpdate: {
          kind: "update-message-content",
          messageId: message.messageId,
          content: cloneMkValue(updated.content),
        },
      };
    }
    return {
      status: "existing",
      mk: existing,
      isNew: false,
      message: original,
      textUpdate: null,
    };
  }
  if (seed === undefined) {
    return {
      status: "seed-required",
      mk: null,
      isNew: false,
      message: original,
      reason: "消息缺少有效 MK，调用方必须注入 timestamp 与 token。",
      textUpdate: null,
    };
  }
  let mk: string;
  try {
    mk = generateMessageKey(seed);
  } catch (error) {
    return {
      status: "invalid",
      mk: null,
      isNew: false,
      message: original,
      reason: error instanceof Error ? error.message : String(error),
      textUpdate: null,
    };
  }
  const updated = canonicalizeMessageKey(message, mk);
  return {
    status: "created",
    mk,
    isNew: true,
    message: updated,
    textUpdate: {
      kind: "update-message-content",
      messageId: message.messageId,
      content: cloneMkValue(updated.content),
    },
  };
}

/** Compact content correspondence for restart recovery; not a security checksum. */
export function messageContentVersion(text: string): string {
  let first = 0x811c9dc5;
  let second = 0x1505;
  for (let index = 0; index < text.length; index++) {
    const value = text.charCodeAt(index);
    first = Math.imul(first ^ value, 0x01000193) >>> 0;
    second = (Math.imul(second, 33) ^ value) >>> 0;
  }
  return `${text.length}:${first.toString(36)}:${second.toString(36)}`;
}
