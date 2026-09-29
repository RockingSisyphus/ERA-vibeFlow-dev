/** Normalization of loose Tavern read results for the MK task. */
export interface NormalizedMessage {
  readonly messageId: number;
  readonly role: string;
  readonly activeText: string;
}

/**
 * 占位符设置属于脚本变量，不写进聊天持久化数据。这里把宿主的宽松对象
 * 收敛为候选 ERA 的两个稳定开关，保证 MK 任务无需接触 Vue 响应式状态。
 */
interface PlaceholderSettings {
  readonly enabled: boolean;
  readonly value: string;
}

const DEFAULT_PLACEHOLDER = "<StatusPlaceHolderImpl/>";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unwrapSuccessful(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.ok === false) {
    const detail = isRecord(value.error) ? value.error.message : value.error;
    throw new Error(String(detail ?? "宿主读取返回失败。"));
  }
  return value.ok === true && Object.prototype.hasOwnProperty.call(value, "value")
    ? value.value
    : value;
}

function messageArray(value: unknown, depth = 0): readonly unknown[] {
  const unwrapped = unwrapSuccessful(value);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (!isRecord(unwrapped) || depth > 4) {
    throw new TypeError("消息读取结果没有 messages 数组。");
  }
  for (const key of ["messages", "chat", "value", "context", "data"]) {
    const nested = unwrapped[key];
    if (Array.isArray(nested)) return nested;
    if (isRecord(nested)) {
      try {
        return messageArray(nested, depth + 1);
      } catch {
        // 尝试下一个兼容包装字段。
      }
    }
  }
  throw new TypeError("消息读取结果没有 messages 数组。");
}

function activeText(message: Record<string, unknown>): string | null {
  if (typeof message.mes === "string") return message.mes;
  if (Array.isArray(message.swipes)) {
    const swipeId = Number(message.swipe_id ?? 0);
    const swipe = message.swipes[swipeId];
    if (typeof swipe === "string") return swipe;
  }
  if (typeof message.message === "string") return message.message;
  if (typeof message.content === "string") return message.content;
  return null;
}

export function normalizeLatestMessage(value: unknown): NormalizedMessage {
  const messages = messageArray(value);
  const raw = messages.at(-1);
  if (!isRecord(raw)) throw new TypeError("当前聊天没有可用消息。");
  const rawId = raw.message_id ?? raw.messageId;
  if (!Number.isSafeInteger(rawId) || Number(rawId) < 0) {
    throw new TypeError("当前消息缺少非负整数 message_id。");
  }
  const text = activeText(raw);
  if (text === null) throw new TypeError("当前激活消息没有文本内容。");
  const role =
    typeof raw.role === "string" && raw.role.length > 0
      ? raw.role
      : raw.is_user === true
        ? "user"
        : "assistant";
  return { messageId: Number(rawId), role, activeText: text };
}

function variablesRecord(value: unknown, depth = 0): Record<string, unknown> {
  const unwrapped = unwrapSuccessful(value);
  if (!isRecord(unwrapped) || depth > 4) {
    throw new TypeError("变量读取结果不是对象。");
  }
  if (
    Object.prototype.hasOwnProperty.call(unwrapped, "ERAMetaData") ||
    Object.prototype.hasOwnProperty.call(unwrapped, "meta")
  ) {
    return unwrapped;
  }
  for (const key of ["variables", "value", "data", "chat"]) {
    if (isRecord(unwrapped[key])) {
      return variablesRecord(unwrapped[key], depth + 1);
    }
  }
  return unwrapped;
}

function cloneJson(value: unknown, path = "$"): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path} 包含非有限数值。`);
    return value;
  }
  if (Array.isArray(value)) {
    return Array.from({ length: value.length }, (_, index) =>
      index in value && typeof value[index] !== "undefined"
        ? cloneJson(value[index], `${path}[${index}]`)
        : null,
    );
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (typeof value[key] !== "undefined") {
        result[key] = cloneJson(value[key], `${path}.${key}`);
      }
    }
    return result;
  }
  throw new TypeError(`${path} 包含不可移植值：${typeof value}。`);
}

export function normalizeMeta(value: unknown): Readonly<Record<string, unknown>> {
  const variables = variablesRecord(value);
  const candidate = isRecord(variables.ERAMetaData)
    ? variables.ERAMetaData
    : isRecord(variables.meta)
      ? variables.meta
      : {};
  return cloneJson(candidate) as Readonly<Record<string, unknown>>;
}

export function normalizePlaceholderSettings(value: unknown): PlaceholderSettings {
  const settings = variablesRecord(value);
  return {
    enabled:
      typeof settings["在ai消息尾部生成特殊符号"] === "boolean"
        ? settings["在ai消息尾部生成特殊符号"]
        : true,
    value:
      typeof settings["特殊符号值"] === "string"
        ? settings["特殊符号值"]
        : DEFAULT_PLACEHOLDER,
  };
}
