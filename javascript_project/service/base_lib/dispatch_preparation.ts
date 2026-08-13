import {
  isEraTavernMessageContextV2,
  type EraDispatchClassV1,
  type EraDispatchContextV2,
  type EraFailureV1,
  type EraTavernMessageV1,
} from "@era/vibeflow-contracts";
import {
  cloneMkValue,
  ensureMessageKey,
  type EraMkMessageV1,
} from "./domain/mk_engine.ts";
import type { BatchExecutionStateV1, PlannedStepV1 } from "./service_types.ts";

export interface DispatchSeedV1 {
  readonly schemaVersion: 1;
  readonly step: PlannedStepV1;
  readonly state: BatchExecutionStateV1;
  readonly dispatchClass: EraDispatchClassV1 | "ignore";
  readonly requirement: "none" | "latest-message" | "latest-message-with-mk";
}

export interface DispatchCanonicalContextV1 {
  readonly schemaVersion: 1;
  readonly seed: DispatchSeedV1;
  readonly status: "ready" | "failed";
  readonly messages: readonly EraTavernMessageV1[];
  readonly meta: Readonly<Record<string, unknown>>;
  readonly placeholder: { readonly enabled: boolean; readonly value: string };
  readonly failure: EraFailureV1 | null;
}

export interface DispatchPreparationPlanV1 {
  readonly schemaVersion: 1;
  readonly seed: DispatchSeedV1;
  readonly status: "ready" | "failed";
  readonly messages: readonly EraTavernMessageV1[];
  readonly processingMessage: EraTavernMessageV1 | null;
  readonly processingMk: string | null;
  readonly messageUpdate: null | {
    readonly messageId: number;
    readonly content: string;
  };
  readonly metaUpdate: Readonly<Record<string, unknown>>;
  readonly messageWriteRequired: boolean;
  readonly variableWriteRequired: boolean;
  readonly failure: EraFailureV1 | null;
}

export interface DispatchPreparationOutcomeV1 extends DispatchPreparationPlanV1 {
  readonly messageChanged: boolean;
  readonly variablesChanged: boolean;
}

const DEFAULT_PLACEHOLDER = "<StatusPlaceHolderImpl/>";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unwrap(value: unknown, depth = 0): unknown {
  if (!isRecord(value) || depth > 4) return value;
  if (value.ok === false)
    throw new Error(
      String(isRecord(value.error) ? value.error.message : value.error),
    );
  return value.ok === true &&
    Object.prototype.hasOwnProperty.call(value, "value")
    ? unwrap(value.value, depth + 1)
    : value;
}

function variablesRecord(value: unknown): Record<string, unknown> {
  const unwrapped = unwrap(value);
  if (!isRecord(unwrapped)) throw new TypeError("变量读取结果不是对象。");
  if (isRecord(unwrapped.variables)) return unwrapped.variables;
  return unwrapped;
}

function failure(
  code: string,
  message: string,
  category: EraFailureV1["category"],
): EraFailureV1 {
  return { code, message, category, retryable: false };
}

function stableToken(step: PlannedStepV1, messageId: number): string {
  if (step.kind !== "execute")
    throw new TypeError("ignore 步骤不需要生成 MK。");
  const source = `${step.task.primaryEvent.eventId}:${step.task.primaryEvent.sequence}:${messageId}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${step.task.primaryEvent.sequence.toString(36)}${hash.toString(36).padStart(7, "0")}`;
}

function selectedMks(
  meta: Readonly<Record<string, unknown>>,
): (string | null)[] {
  return Array.isArray(meta.SelectedMks)
    ? Array.from({ length: meta.SelectedMks.length }, (_, index) =>
        typeof meta.SelectedMks?.[index] === "string"
          ? (meta.SelectedMks[index] as string)
          : null,
      )
    : [];
}

export function classifyDispatch(
  step: PlannedStepV1,
  state: BatchExecutionStateV1,
): { readonly seed: DispatchSeedV1; readonly route: "none" | "read" } {
  if (!isRecord(step) || !isRecord(state) || state.schemaVersion !== 1) {
    throw new TypeError("统一上下文准备缺少有效步骤或批次状态。");
  }
  if (step.kind === "ignore") {
    return {
      seed: {
        schemaVersion: 1,
        step,
        state,
        dispatchClass: "ignore",
        requirement: "none",
      },
      route: "none",
    };
  }
  const dispatchClass = step.task.kind;
  const requirement = step.task.context;
  return {
    seed: { schemaVersion: 1, step, state, dispatchClass, requirement },
    route: requirement === "none" ? "none" : "read",
  };
}

export function buildNoHostOutcome(
  seed: DispatchSeedV1,
): DispatchPreparationOutcomeV1 {
  return {
    schemaVersion: 1,
    seed,
    status: "ready",
    messages: [],
    processingMessage: null,
    processingMk: null,
    messageUpdate: null,
    metaUpdate: {},
    messageWriteRequired: false,
    variableWriteRequired: false,
    messageChanged: false,
    variablesChanged: false,
    failure: null,
  };
}

export function canonicalDispatchContext(
  seed: DispatchSeedV1,
  messagesRaw: unknown,
  chatVariablesRaw: unknown,
  scriptVariablesRaw: unknown,
): DispatchCanonicalContextV1 {
  try {
    const messagesValue = unwrap(messagesRaw);
    if (!isEraTavernMessageContextV2(messagesValue)) {
      throw new TypeError(
        "消息 Capability 未返回 EraTavernMessageContextV2。 ",
      );
    }
    const chatVariables = variablesRecord(chatVariablesRaw);
    const scriptVariables = variablesRecord(scriptVariablesRaw);
    const metaCandidate = chatVariables.ERAMetaData ?? chatVariables.meta ?? {};
    if (!isRecord(metaCandidate)) throw new TypeError("ERAMetaData 不是对象。");
    return {
      schemaVersion: 1,
      seed,
      status: "ready",
      messages: cloneMkValue(messagesValue.messages),
      meta: cloneMkValue(metaCandidate),
      placeholder: {
        enabled:
          typeof scriptVariables["在ai消息尾部生成特殊符号"] === "boolean"
            ? (scriptVariables["在ai消息尾部生成特殊符号"] as boolean)
            : true,
        value:
          typeof scriptVariables["特殊符号值"] === "string"
            ? (scriptVariables["特殊符号值"] as string)
            : DEFAULT_PLACEHOLDER,
      },
      failure: null,
    };
  } catch (error) {
    return {
      schemaVersion: 1,
      seed,
      status: "failed",
      messages: [],
      meta: {},
      placeholder: { enabled: true, value: DEFAULT_PLACEHOLDER },
      failure: failure(
        "ERA_DISPATCH_CONTEXT_INVALID",
        error instanceof Error ? error.message : String(error),
        "input",
      ),
    };
  }
}

export function planDispatchPreparation(
  context: DispatchCanonicalContextV1,
): DispatchPreparationPlanV1 {
  if (context.status === "failed") {
    return {
      schemaVersion: 1,
      seed: context.seed,
      status: "failed",
      messages: [],
      processingMessage: null,
      processingMk: null,
      messageUpdate: null,
      metaUpdate: {},
      messageWriteRequired: false,
      variableWriteRequired: false,
      failure: context.failure,
    };
  }
  const latest = context.messages.at(-1) ?? null;
  if (latest === null) {
    return {
      schemaVersion: 1,
      seed: context.seed,
      status: "failed",
      messages: context.messages,
      processingMessage: null,
      processingMk: null,
      messageUpdate: null,
      metaUpdate: context.meta,
      messageWriteRequired: false,
      variableWriteRequired: false,
      failure: failure(
        "ERA_DISPATCH_EMPTY_CHAT",
        "当前聊天没有可准备的消息。",
        "input",
      ),
    };
  }
  if (context.seed.requirement === "latest-message") {
    return {
      schemaVersion: 1,
      seed: context.seed,
      status: "ready",
      messages: context.messages,
      processingMessage: latest,
      processingMk: null,
      messageUpdate: null,
      metaUpdate: context.meta,
      messageWriteRequired: false,
      variableWriteRequired: false,
      failure: null,
    };
  }
  const message: EraMkMessageV1 = {
    messageId: latest.messageId,
    role: latest.role,
    content: { kind: "text", text: latest.activeText },
  };
  const primary =
    context.seed.step.kind === "execute"
      ? context.seed.step.task.primaryEvent
      : null;
  if (primary === null) throw new TypeError("ignore 步骤不能进入消息准备。");
  const ensured = ensureMessageKey(message, {
    timestamp: Math.max(0, Math.trunc(primary.occurredAt)),
    token: stableToken(context.seed.step, latest.messageId),
  });
  if (ensured.status === "invalid" || ensured.status === "seed-required") {
    return {
      schemaVersion: 1,
      seed: context.seed,
      status: "failed",
      messages: context.messages,
      processingMessage: latest,
      processingMk: null,
      messageUpdate: null,
      metaUpdate: context.meta,
      messageWriteRequired: false,
      variableWriteRequired: false,
      failure: failure("ERA_DISPATCH_MK_FAILED", ensured.reason, "domain"),
    };
  }
  const mkText =
    ensured.textUpdate?.content.kind === "text"
      ? ensured.textUpdate.content.text
      : latest.activeText;
  const preparedText =
    latest.role !== "user" &&
    context.placeholder.enabled &&
    context.placeholder.value.length > 0 &&
    !mkText.includes(context.placeholder.value)
      ? `${mkText.trimEnd()}\n${context.placeholder.value}`
      : mkText;
  const preparedLatest: EraTavernMessageV1 = {
    ...latest,
    activeText: preparedText,
  };
  const messages = context.messages.map((item) =>
    item.messageId === latest.messageId ? preparedLatest : item,
  );
  const metaUpdate = cloneMkValue(context.meta) as Record<string, unknown>;
  const ownsSelectedMkCommit = context.seed.dispatchClass === "update-mk";
  let variableWriteRequired = false;
  if (ownsSelectedMkCommit) {
    const chain = selectedMks(context.meta);
    while (chain.length <= latest.messageId) chain.push(null);
    variableWriteRequired = chain[latest.messageId] !== ensured.mk;
    chain[latest.messageId] = ensured.mk;
    Object.defineProperty(metaUpdate, "SelectedMks", {
      value: chain,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return {
    schemaVersion: 1,
    seed: context.seed,
    status: "ready",
    messages,
    processingMessage: preparedLatest,
    processingMk: ensured.mk,
    messageUpdate:
      preparedText === latest.activeText
        ? null
        : { messageId: latest.messageId, content: preparedText },
    metaUpdate,
    messageWriteRequired: preparedText !== latest.activeText,
    variableWriteRequired,
    failure: null,
  };
}

export function preserveDispatchPreparation(
  plan: DispatchPreparationPlanV1,
): DispatchPreparationOutcomeV1 {
  return { ...plan, messageChanged: false, variablesChanged: false };
}

export function dispatchContextOf(
  outcome: DispatchPreparationOutcomeV1,
): EraDispatchContextV2 {
  return {
    schemaVersion: 2,
    status: outcome.status,
    dispatchClass: outcome.seed.dispatchClass,
    requirement: outcome.seed.requirement,
    messages: outcome.messages,
    processingMessage: outcome.processingMessage,
    processingMk: outcome.processingMk,
    messageChanged: outcome.messageChanged,
    variablesChanged: outcome.variablesChanged,
    failure: outcome.failure,
  };
}
