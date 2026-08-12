import {
  cloneMkValue,
  ensureMessageKey,
  type EraMkMessageV1,
} from "../../base_lib/domain/mk_engine.ts";
import type { PlannedStepV1 } from "../../base_lib/service_types.ts";

interface Envelope<T> {
  readonly value: T;
}

interface MkFailure {
  readonly code: string;
  readonly message: string;
  readonly category: "input" | "domain" | "tavern" | "cancelled";
  readonly retryable: false;
}

interface MkContext {
  readonly schemaVersion: 1;
  readonly step: PlannedStepV1;
  readonly status: "ready" | "failed";
  readonly message: null | {
    readonly messageId: number;
    readonly role: string;
    readonly activeText: string;
  };
  readonly meta: Readonly<Record<string, unknown>> | null;
  readonly placeholderSettings: null | {
    readonly enabled: boolean;
    readonly value: string;
  };
  readonly failure: MkFailure | null;
}

function appendPlaceholder(
  text: string,
  role: string,
  settings: MkContext["placeholderSettings"],
): string {
  if (role === "user" || settings === null || !settings.enabled) return text;
  if (settings.value.length === 0 || text.includes(settings.value)) return text;
  return `${text.trimEnd()}\n${settings.value}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function candidateFailure(
  step: PlannedStepV1,
  failure: MkFailure,
): Readonly<Record<string, unknown>> {
  return {
    schemaVersion: 1,
    step,
    disposition: "failed",
    mk: null,
    messageUpdate: null,
    metaUpdate: null,
    messageWriteRequired: false,
    variableWriteRequired: false,
    failure,
  };
}

function stableBase36Token(eventId: string, sequence: number): string {
  const source = `${eventId}:${sequence}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${sequence.toString(36)}${hash.toString(36).padStart(7, "0")}`;
}

function selectedMks(
  meta: Readonly<Record<string, unknown>>,
): (string | null)[] {
  const selected = meta.SelectedMks;
  if (!Array.isArray(selected)) return [];
  return Array.from({ length: selected.length }, (_, index) => {
    const value = index in selected ? selected[index] : null;
    return typeof value === "string" ? value : null;
  });
}

function primarySeed(step: PlannedStepV1): {
  readonly timestamp: number;
  readonly token: string;
} {
  if (step.kind !== "execute" || step.task.kind !== "update-mk") {
    throw new TypeError("MK 推导收到非 update-mk execute 步骤。");
  }
  const primary = step.task.primaryEvent;
  const timestamp = Math.trunc(primary.occurredAt);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new TypeError("MK 主事件 occurredAt 不能转换为非负安全整数。");
  }
  if (!Number.isSafeInteger(primary.sequence) || primary.sequence < 0) {
    throw new TypeError("MK 主事件 sequence 必须是非负安全整数。");
  }
  return {
    timestamp,
    token: stableBase36Token(primary.eventId, primary.sequence),
  };
}

export function run(
  inputs: Readonly<{ "era.mk.context": Envelope<unknown> }>,
): any {
  const context = inputs["era.mk.context"].value as MkContext;
  if (context.status === "failed") {
    return {
      mk_candidate: candidateFailure(
        context.step,
        context.failure ?? {
          code: "ERA_UPDATE_MK_CONTEXT_FAILED",
          message: "MK 读取上下文失败但未提供错误详情。",
          category: "domain",
          retryable: false,
        },
      ),
    };
  }
  if (!context.message || !isRecord(context.meta)) {
    return {
      mk_candidate: candidateFailure(context.step, {
        code: "ERA_UPDATE_MK_CONTEXT_INVALID",
        message: "MK 上下文缺少消息或 ERA 元数据。",
        category: "input",
        retryable: false,
      }),
    };
  }

  const message: EraMkMessageV1 = {
    messageId: context.message.messageId,
    role: context.message.role,
    content: { kind: "text", text: context.message.activeText },
  };
  let ensured: ReturnType<typeof ensureMessageKey>;
  try {
    ensured = ensureMessageKey(message, primarySeed(context.step));
  } catch (error) {
    return {
      mk_candidate: candidateFailure(context.step, {
        code: "ERA_UPDATE_MK_SEED_INVALID",
        message: error instanceof Error ? error.message : String(error),
        category: "input",
        retryable: false,
      }),
    };
  }
  if (ensured.status === "invalid" || ensured.status === "seed-required") {
    return {
      mk_candidate: candidateFailure(context.step, {
        code: "ERA_UPDATE_MK_DERIVE_FAILED",
        message: ensured.reason,
        category: "domain",
        retryable: false,
      }),
    };
  }

  const currentSelectedMks = selectedMks(context.meta);
  while (currentSelectedMks.length <= context.message.messageId) {
    currentSelectedMks.push(null);
  }
  const variableWriteRequired =
    currentSelectedMks[context.message.messageId] !== ensured.mk;
  currentSelectedMks[context.message.messageId] = ensured.mk;
  const metaUpdate = cloneMkValue(context.meta) as Record<string, unknown>;
  metaUpdate.SelectedMks = currentSelectedMks;

  const textUpdate = ensured.textUpdate;
  if (textUpdate !== null && textUpdate.content.kind !== "text") {
    return {
      mk_candidate: candidateFailure(context.step, {
        code: "ERA_UPDATE_MK_CONTENT_UNSUPPORTED",
        message: "当前 Tavern MK 提交边界只接受激活文本更新。",
        category: "domain",
        retryable: false,
      }),
    };
  }
  const mkText =
    textUpdate === null
      ? context.message.activeText
      : textUpdate.content.text;
  const content = appendPlaceholder(
    mkText,
    context.message.role,
    context.placeholderSettings,
  );
  const messageUpdate =
    content === context.message.activeText
      ? null
      : { messageId: context.message.messageId, content };

  return {
    mk_candidate: {
      schemaVersion: 1,
      step: context.step,
      disposition: "ready",
      mk: ensured.mk,
      messageUpdate,
      metaUpdate,
      messageWriteRequired: messageUpdate !== null,
      variableWriteRequired,
      failure: null,
    },
  };
}
