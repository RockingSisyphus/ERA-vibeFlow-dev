import type { PlannedStepV1 } from "../../base_lib/service_types.ts";

interface Envelope<T> {
  readonly value: T;
}

interface Context {
  readonly capabilities: {
    readonly "era.tavern.messages": {
      readonly read_context: (
        input: Readonly<Record<string, unknown>>,
      ) => Promise<unknown>;
    };
    readonly "era.tavern.variables": {
      readonly read: (
        input: Readonly<Record<string, unknown>>,
      ) => Promise<unknown>;
    };
  };
}

type FailureCategory = "input" | "tavern" | "cancelled";

interface MkFailure {
  readonly code: string;
  readonly message: string;
  readonly category: FailureCategory;
  readonly retryable: false;
}

interface NormalizedMessage {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isCancellation(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return true;
  return /abort|cancel|取消/i.test(errorMessage(error));
}

function failure(
  code: string,
  message: string,
  category: FailureCategory,
): MkFailure {
  return { code, message, category, retryable: false };
}

function assertUpdateMkStep(value: unknown): PlannedStepV1 {
  if (!isRecord(value) || value.kind !== "execute") {
    throw new TypeError("MK 任务要求 execute PlannedStep。");
  }
  if (value.taskRoute !== "update-mk" || !isRecord(value.task)) {
    throw new TypeError("MK 任务收到非 update-mk 路由。");
  }
  if (value.task.kind !== "update-mk" || !Array.isArray(value.sources)) {
    throw new TypeError("MK 任务缺少完整 task/sources 契约。");
  }
  if (value.sources.length === 0) {
    throw new TypeError("MK 任务没有可结算来源。");
  }
  return value as PlannedStepV1;
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

function normalizeLatestMessage(value: unknown): NormalizedMessage {
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

function normalizeMeta(value: unknown): Readonly<Record<string, unknown>> {
  const variables = variablesRecord(value);
  const candidate = isRecord(variables.ERAMetaData)
    ? variables.ERAMetaData
    : isRecord(variables.meta)
      ? variables.meta
      : {};
  return cloneJson(candidate) as Readonly<Record<string, unknown>>;
}

function normalizePlaceholderSettings(value: unknown): PlaceholderSettings {
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

export async function run(
  inputs: Readonly<{
    "era.step.request.routed": Envelope<unknown>;
  }>,
  _params: Readonly<Record<string, unknown>>,
  context: Context,
): Promise<any> {
  let step: PlannedStepV1;
  try {
    step = assertUpdateMkStep(inputs["era.step.request.routed"].value);
  } catch (error) {
    return {
      mk_context: {
        schemaVersion: 1,
        step: inputs["era.step.request.routed"].value,
        status: "failed",
        message: null,
        meta: null,
        placeholderSettings: null,
        failure: failure(
          "ERA_UPDATE_MK_STEP_INVALID",
          errorMessage(error),
          "input",
        ),
      },
    };
  }

  let message: NormalizedMessage;
  try {
    const raw = await context.capabilities[
      "era.tavern.messages"
    ].read_context({
      projection: "era-active-message-v1",
      range: -1,
      purpose: "era-update-mk",
    });
    message = normalizeLatestMessage(raw);
  } catch (error) {
    const cancelled = isCancellation(error);
    return {
      mk_context: {
        schemaVersion: 1,
        step,
        status: "failed",
        message: null,
        meta: null,
        placeholderSettings: null,
        failure: failure(
          cancelled
            ? "ERA_UPDATE_MK_READ_CANCELLED"
            : "ERA_UPDATE_MK_MESSAGE_READ_FAILED",
          errorMessage(error),
          cancelled ? "cancelled" : "tavern",
        ),
      },
    };
  }

  try {
    const raw = await context.capabilities["era.tavern.variables"].read({
      scope: { type: "chat" },
      fields: ["ERAMetaData"],
      purpose: "era-update-mk",
    });
    const scriptRaw = await context.capabilities["era.tavern.variables"].read({
      scope: { type: "script" },
      fields: ["在ai消息尾部生成特殊符号", "特殊符号值"],
      purpose: "era-update-mk-placeholder-settings",
    });
    return {
      mk_context: {
        schemaVersion: 1,
        step,
        status: "ready",
        message,
        meta: normalizeMeta(raw),
        placeholderSettings: normalizePlaceholderSettings(scriptRaw),
        failure: null,
      },
    };
  } catch (error) {
    const cancelled = isCancellation(error);
    return {
      mk_context: {
        schemaVersion: 1,
        step,
        status: "failed",
        message,
        meta: null,
        placeholderSettings: null,
        failure: failure(
          cancelled
            ? "ERA_UPDATE_MK_READ_CANCELLED"
            : "ERA_UPDATE_MK_VARIABLES_READ_FAILED",
          errorMessage(error),
          cancelled ? "cancelled" : "tavern",
        ),
      },
    };
  }
}
