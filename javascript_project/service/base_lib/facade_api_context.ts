import {
cloneEraPortableJsonV1,
isEraDispatchContextV3,
isEraTavernMessageContextV2,
type EraApiTaskV1,
type EraFailureV1,
type EraPlannedSourceV1
} from "@era/vibeflow-contracts";
import type { BatchExecutionStateV1,PlannedStepV1 } from "./service_types.ts";

export type FacadeScope = "message" | "branch" | "always";

export type OperationName =
  | "insert"
  | "edit"
  | "delete"
  | "functionInsert"
  | "functionEdit"
  | "functionDelete";

export function scopeCode(scope: FacadeScope): "m" | "b" | "a" {
  return scope === "message" ? "m" : scope === "branch" ? "b" : "a";
}

export function operationTag(name: OperationName): string {
  if (name === "insert") return "VariableInsert";
  if (name === "edit") return "VariableEdit";
  if (name === "delete") return "VariableDelete";
  if (name === "functionInsert") return "FunctionInsert";
  if (name === "functionEdit") return "FunctionEdit";
  return "FunctionDelete";
}

export function isOperationName(value: string): value is OperationName {
  return (
    value === "insert" ||
    value === "edit" ||
    value === "delete" ||
    value === "functionInsert" ||
    value === "functionEdit" ||
    value === "functionDelete"
  );
}

export interface ScopeWindowState {
  readonly token: number | null;
  readonly messageId: number | null;
  readonly messageAdmission: boolean | null;
  readonly branchAdmission: boolean | null;
}

interface ApiRequest {
  readonly task: EraApiTaskV1;
  readonly sources: readonly EraPlannedSourceV1[];
  readonly dispatchContext: unknown;
  readonly detail: Readonly<Record<string, unknown>>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function failure(
  code: string,
  message: string,
  category: EraFailureV1["category"] = "input",
): EraFailureV1 {
  return { code, message, category, retryable: false };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function requireRequest(value: unknown): ApiRequest {
  if (
    !isRecord(value) ||
    !isRecord(value.task) ||
    !Array.isArray(value.sources)
  ) {
    throw new TypeError("公共 Facade 请求缺少 task 或来源。");
  }
  const task = value.task as unknown as EraApiTaskV1;
  if (task.kind !== "api" || value.sources.length === 0) {
    throw new TypeError("公共 Facade 只接受拥有来源的 api task。");
  }
  const detail = isRecord(value.detail) ? value.detail : {};
  return {
    task,
    sources: value.sources as unknown as readonly EraPlannedSourceV1[],
    dispatchContext: value.dispatchContext,
    detail,
  };
}

function messagesFrom(value: unknown) {
  if (!isEraTavernMessageContextV2(value)) {
    throw new TypeError(
      "消息 Capability 未返回严格 era-active-message-v2 上下文。",
    );
  }
  return value.messages;
}

function latestAi(messages: ReturnType<typeof messagesFrom>) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (message.role !== "user") return message;
  }
  throw new Error("当前聊天没有可供 ERA.commit 写入的 AI 消息。");
}

function targetAi(
  messages: ReturnType<typeof messagesFrom>,
  request: ApiRequest,
  identity: unknown,
): {
  readonly message: ReturnType<typeof latestAi>;
  readonly sourceInvalid: boolean;
} {
  if (!Object.prototype.hasOwnProperty.call(request.detail, "sourceContext")) {
    return { message: latestAi(messages), sourceInvalid: false };
  }
  const verified =
    isRecord(identity) && isRecord(identity.statusbarSource)
      ? identity.statusbarSource
      : null;
  const requested = request.detail.sourceContext;
  if (!verified || !isRecord(requested)) {
    return { message: latestAi(messages), sourceInvalid: true };
  }
  const exact = [
    "kind",
    "pageEpoch",
    "instanceId",
    "characterId",
    "groupId",
    "chatId",
    "messageId",
    "mk",
    "swipeId",
    "iframeName",
  ].every((key) => verified[key] === requested[key]);
  const message = messages.find(
    (candidate) =>
      candidate.messageId === verified.messageId && candidate.role !== "user",
  );
  return message && exact
    ? { message, sourceInvalid: false }
    : { message: latestAi(messages), sourceInvalid: true };
}

function hasScopeMarker(text: string, code: "m" | "b"): boolean {
  const escaped = code === "m" ? "m" : "b";
  return new RegExp(`<era_tx\\b[^>]*\\bs=["']${escaped}["'][^>]*>`, "i").test(
    text,
  );
}

export function readLifecycleToken(identity: unknown): number {
  const token = isRecord(identity) ? identity.lifecycleToken : null;
  if (!Number.isSafeInteger(token) || Number(token) < 1) {
    throw new TypeError("Tavern 身份缺少有效 lifecycleToken。");
  }
  return Number(token);
}

export function sameIdentity(left: unknown, right: unknown): boolean {
  if (!isRecord(left) || !isRecord(right)) return false;
  return [
    "characterId",
    "groupId",
    "chatId",
    "scriptId",
    "lifecycleToken",
  ].every((key) => left[key] === right[key]);
}

export function stateUpdate(
  execution: BatchExecutionStateV1,
  scopeWindow: ScopeWindowState,
) {
  return {
    consecutiveMk: execution.nextState.consecutiveMk,
    consecutiveProcessingCount: execution.nextState.consecutiveProcessingCount,
    scopeWindow,
  };
}

export function settlements(
  request: ApiRequest,
  status: "completed" | "failed",
  value: Readonly<Record<string, unknown>> | EraFailureV1,
) {
  return request.sources.map((source) =>
    status === "completed"
      ? {
          eventId: source.event.eventId,
          sequence: source.event.sequence,
          status: "completed" as const,
          taskId: request.task.id,
          relation: source.relation,
          value: cloneEraPortableJsonV1(value),
        }
      : {
          eventId: source.event.eventId,
          sequence: source.event.sequence,
          status: "failed" as const,
          error: value as EraFailureV1,
        },
  );
}

export function routeFacadeCommand(
  step: PlannedStepV1,
  executionState: BatchExecutionStateV1,
) {
  if (step.kind !== "execute" || step.task.kind !== "api") {
    throw new TypeError("Facade 路由只接受 api execute 步骤。");
  }
  const request: Record<string, unknown> = {
    task: step.task,
    sources: step.sources,
    dispatchContext: step.dispatchContext,
  };
  const first = step.task.args[0];
  if (first?.kind === "json" && isRecord(first.value))
    request.detail = first.value;
  const route =
    step.task.eventType === "era.facade.commit"
      ? "commit"
      : step.task.eventType === "era.facade.sync"
        ? "sync"
        : "failed";
  return { request, executionState, route };
}

export function inspectWindow(
  rawRequest: unknown,
  executionState: BatchExecutionStateV1,
  identity: unknown,
  rawMessages: unknown,
  position?: { readonly messageId: number },
) {
  const request = requireRequest(rawRequest);
  const messages = messagesFrom(rawMessages);
  const positioned = position
    ? messages.find((message) => message.messageId === position.messageId)
    : null;
  const targeted = position
    ? { message: positioned ?? latestAi(messages), sourceInvalid: !positioned }
    : targetAi(messages, request, identity);
  const prepared = request.dispatchContext;
  const preparedMessage =
    isEraDispatchContextV3(prepared) &&
    prepared.processingMessage?.messageId === targeted.message.messageId
      ? prepared.processingMessage
      : null;
  const latest =
    preparedMessage === null
      ? targeted.message
      : { ...targeted.message, activeText: preparedMessage.activeText };
  const token = readLifecycleToken(identity);
  const previous = executionState.nextState.scopeWindow as ScopeWindowState;
  const window: ScopeWindowState =
    previous.token === token && previous.messageId === latest.messageId
      ? previous
      : {
          token,
          messageId: latest.messageId,
          messageAdmission: !hasScopeMarker(latest.activeText, "m"),
          branchAdmission: !messages.some((message) =>
            hasScopeMarker(message.activeText, "b"),
          ),
        };
  const sourceBasis =
    isEraDispatchContextV3(prepared) && prepared.sourceBasis !== undefined
      ? prepared.sourceBasis
      : {
          identity: {
            characterId: isRecord(identity)
              ? (identity.characterId ?? null)
              : null,
            chatId: isRecord(identity) ? identity.chatId : null,
            groupId: isRecord(identity) ? (identity.groupId ?? null) : null,
          },
          messages,
        };
  return {
    request,
    executionState,
    identity,
    messages,
    latest,
    window,
    sourceBasis,
    sourceInvalid: targeted.sourceInvalid,
  };
}

export function normalizeScope(value: unknown): FacadeScope | null {
  if (value === undefined || value === "message") return "message";
  if (value === "branch" || value === "always") return value;
  return null;
}

export function normalizeOperations(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("ERA.commit operations 必须是非空数组。");
  }
  return value.map((raw, index) => {
    if (!isRecord(raw))
      throw new TypeError(`operations[${index}] 必须是对象。`);
    const keys = Object.keys(raw);
    if (keys.length !== 1 || !isOperationName(keys[0]!)) {
      throw new TypeError(`operations[${index}] 必须且只能包含六类操作之一。`);
    }
    const name = keys[0] as OperationName;
    const payload = raw[name];
    if (!isRecord(payload))
      throw new TypeError(`operations[${index}].${name} 必须是对象。`);
    return { name, payload: cloneEraPortableJsonV1(payload) };
  });
}
