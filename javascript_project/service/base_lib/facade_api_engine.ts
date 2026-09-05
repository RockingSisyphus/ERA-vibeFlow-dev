import {
  cloneEraPortableJsonV1,
  isEraDispatchContextV2,
  isEraDispatchContextV3,
  isEraTavernMessageContextV2,
  type EraApiTaskV1,
  type EraFailureV1,
  type EraPlannedSourceV1,
  type EraSyncTaskV1,
  type EraTaskResultV1,
} from "@era/vibeflow-contracts";
import type { BatchExecutionStateV1, PlannedStepV1 } from "./service_types.ts";

export type FacadeScope = "message" | "branch" | "always";

type OperationName = "insert" | "edit" | "delete" | "functionInsert" | "functionEdit" | "functionDelete";

function scopeCode(scope: FacadeScope): "m" | "b" | "a" {
  return scope === "message" ? "m" : scope === "branch" ? "b" : "a";
}

function operationTag(name: OperationName): string {
  if (name === "insert") return "VariableInsert";
  if (name === "edit") return "VariableEdit";
  if (name === "delete") return "VariableDelete";
  if (name === "functionInsert") return "FunctionInsert";
  if (name === "functionEdit") return "FunctionEdit";
  return "FunctionDelete";
}

function isOperationName(value: string): value is OperationName {
  return value === "insert" || value === "edit" || value === "delete" ||
    value === "functionInsert" || value === "functionEdit" || value === "functionDelete";
}

interface ScopeWindowState {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function failure(
  code: string,
  message: string,
  category: EraFailureV1["category"] = "input",
): EraFailureV1 {
  return { code, message, category, retryable: false };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requireRequest(value: unknown): ApiRequest {
  if (!isRecord(value) || !isRecord(value.task) || !Array.isArray(value.sources)) {
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
    throw new TypeError("消息 Capability 未返回严格 era-active-message-v1 上下文。");
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
): { readonly message: ReturnType<typeof latestAi>; readonly sourceInvalid: boolean } {
  if (!Object.prototype.hasOwnProperty.call(request.detail, "sourceContext")) {
    return { message: latestAi(messages), sourceInvalid: false };
  }
  const verified = isRecord(identity) && isRecord(identity.statusbarSource)
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
  const message = messages.find((candidate) => candidate.messageId === verified.messageId && candidate.role !== "user");
  return message && exact
    ? { message, sourceInvalid: false }
    : { message: latestAi(messages), sourceInvalid: true };
}

function hasScopeMarker(text: string, code: "m" | "b"): boolean {
  const escaped = code === "m" ? "m" : "b";
  return new RegExp(`<era_tx\\b[^>]*\\bs=["']${escaped}["'][^>]*>`, "i").test(text);
}

function readLifecycleToken(identity: unknown): number {
  const token = isRecord(identity) ? identity.lifecycleToken : null;
  if (!Number.isSafeInteger(token) || Number(token) < 1) {
    throw new TypeError("Tavern 身份缺少有效 lifecycleToken。");
  }
  return Number(token);
}

function sameIdentity(left: unknown, right: unknown): boolean {
  if (!isRecord(left) || !isRecord(right)) return false;
  return ["characterId", "groupId", "chatId", "scriptId", "lifecycleToken"].every(
    (key) => left[key] === right[key],
  );
}

function stateUpdate(
  execution: BatchExecutionStateV1,
  scopeWindow: ScopeWindowState,
) {
  return {
    consecutiveMk: execution.nextState.consecutiveMk,
    consecutiveProcessingCount: execution.nextState.consecutiveProcessingCount,
    scopeWindow,
  };
}

function settlements(
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
  if (first?.kind === "json" && isRecord(first.value)) request.detail = first.value;
  const route = step.task.eventType === "era.facade.commit"
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
) {
  const request = requireRequest(rawRequest);
  const messages = messagesFrom(rawMessages);
  const targeted = targetAi(messages, request, identity);
  const prepared = request.dispatchContext;
  const preparedMessage =
    isEraDispatchContextV3(prepared) &&
    prepared.processingMessage?.messageId === targeted.message.messageId
      ? prepared.processingMessage
      : null;
  const latest = preparedMessage === null
    ? targeted.message
    : { ...targeted.message, activeText: preparedMessage.activeText };
  const token = readLifecycleToken(identity);
  const previous = executionState.nextState.scopeWindow as ScopeWindowState;
  const window: ScopeWindowState = previous.token === token && previous.messageId === latest.messageId
    ? previous
    : {
        token,
        messageId: latest.messageId,
        messageAdmission: !hasScopeMarker(latest.activeText, "m"),
        branchAdmission: !messages.some((message) => hasScopeMarker(message.activeText, "b")),
      };
  return { request, executionState, identity, messages, latest, window, sourceInvalid: targeted.sourceInvalid };
}

function normalizeScope(value: unknown): FacadeScope | null {
  if (value === undefined || value === "message") return "message";
  if (value === "branch" || value === "always") return value;
  return null;
}

function normalizeOperations(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("ERA.commit operations 必须是非空数组。");
  }
  return value.map((raw, index) => {
    if (!isRecord(raw)) throw new TypeError(`operations[${index}] 必须是对象。`);
    const keys = Object.keys(raw);
    if (keys.length !== 1 || !isOperationName(keys[0]!)) {
      throw new TypeError(`operations[${index}] 必须且只能包含六类操作之一。`);
    }
    const name = keys[0] as OperationName;
    const payload = raw[name];
    if (!isRecord(payload)) throw new TypeError(`operations[${index}].${name} 必须是对象。`);
    return { name, payload: cloneEraPortableJsonV1(payload) };
  });
}

export function validateCommit(inspected: unknown) {
  if (!isRecord(inspected)) throw new TypeError("窗口读取上下文损坏。");
  const request = requireRequest(inspected.request);
  try {
    if (inspected.sourceInvalid === true) {
      return {
        route: "failed",
        context: inspected,
        error: failure(
          "ERA_API_STATUSBAR_SOURCE_INVALID",
          "状态栏来源楼层、Swipe 或页面实例已经失效。",
          "cancelled",
        ),
      };
    }
    const requestedToken = request.detail.windowToken;
    const currentToken = readLifecycleToken(inspected.identity);
    if (!Number.isSafeInteger(requestedToken) || Number(requestedToken) !== currentToken) {
      return {
        route: "failed",
        context: inspected,
        error: failure("ERA_API_WINDOW_CHANGED", "ERA.commit 入队后 Tavern 生命周期窗口已经变化。", "cancelled"),
      };
    }
    const scope = normalizeScope(request.detail.scope);
    if (scope === null) {
      return { route: "failed", context: inspected, error: failure("ERA_API_SCOPE_INVALID", "scope 只允许 message、branch 或 always。") };
    }
    const operations = normalizeOperations(request.detail.operations);
    const window = inspected.window as ScopeWindowState;
    const allowed = scope === "always" || (scope === "message" ? window.messageAdmission : window.branchAdmission);
    return allowed
      ? { route: "commit", context: { ...inspected, scope, operations } }
      : { route: "skipped", context: { ...inspected, scope, operations } };
  } catch (error) {
    return { route: "failed", context: inspected, error: failure("ERA_API_COMMIT_INVALID", errorMessage(error)) };
  }
}

export function buildTransaction(validated: unknown) {
  if (!isRecord(validated) || !Array.isArray(validated.operations)) {
    throw new TypeError("事务构造只接受已准入的 commit。");
  }
  const scope = validated.scope as FacadeScope;
  const content = validated.operations.map((operation) => {
    if (!isRecord(operation) || !isOperationName(String(operation.name))) {
      throw new TypeError("已校验操作在事务构造阶段损坏。");
    }
    const tag = operationTag(operation.name as OperationName);
    return `<${tag}>${JSON.stringify(operation.payload)}</${tag}>`;
  }).join("");
  return { ...validated, transaction: `<era_tx s="${scopeCode(scope)}">${content}</era_tx>` };
}

export function buildAppend(transaction: unknown) {
  if (!isRecord(transaction) || !isRecord(transaction.latest) || typeof transaction.transaction !== "string") {
    throw new TypeError("消息追加计划缺少目标或 era_tx。");
  }
  const latest = transaction.latest;
  const id = latest.messageId;
  if (!Number.isSafeInteger(id) || Number(id) < 0 || typeof latest.activeText !== "string") {
    throw new TypeError("最新 AI 消息不是严格文本投影。");
  }
  const content = `${latest.activeText}\n${transaction.transaction}`;
  return {
    ...transaction,
    messageId: Number(id),
    originalContent: latest.activeText,
    committedContent: content,
    capabilityInput: {
      messageId: Number(id),
      content,
      refresh: "none",
      purpose: "era-facade-commit",
      projectTechnicalBlocks: false,
    },
  };
}

export function recheckWindow(append: unknown, currentIdentity: unknown) {
  if (!isRecord(append)) throw new TypeError("窗口复核缺少追加计划。");
  const request = isRecord(append.request) ? requireRequest(append.request) : null;
  const sourceRequested = request && Object.prototype.hasOwnProperty.call(request.detail, "sourceContext");
  const currentSource = isRecord(currentIdentity) ? currentIdentity.statusbarSource : null;
  const sourceCurrent = !sourceRequested || (
    isRecord(request!.detail.sourceContext) &&
    isRecord(currentSource) &&
    ["kind", "pageEpoch", "instanceId", "characterId", "groupId", "chatId", "messageId", "mk", "swipeId", "iframeName"]
      .every((key) => (request!.detail.sourceContext as Record<string, unknown>)[key] === currentSource[key])
  );
  return sameIdentity(append.identity, currentIdentity) && sourceCurrent
    ? { route: "current", context: append }
    : {
        route: "changed",
        context: append,
        error: failure("ERA_API_WINDOW_CHANGED", "写入前身份或生命周期窗口已经变化。", "cancelled"),
      };
}

export function verifyCommitted(appendResult: unknown, rawMessages: unknown) {
  if (!isRecord(appendResult) || appendResult.status !== "committed" || !isRecord(appendResult.context)) {
    return { route: "failed", context: appendResult, error: failure("ERA_API_MESSAGE_APPEND_FAILED", "Tavern 未确认 era_tx 写入。", "tavern") };
  }
  const context = appendResult.context;
  try {
    const messages = messagesFrom(rawMessages);
    const matches = messages.filter((message) => message.messageId === context.messageId);
    if (matches.length !== 1 || matches[0]!.activeText !== context.committedContent) {
      return { route: "failed", context, error: failure("ERA_API_MESSAGE_READBACK_MISMATCH", "era_tx 回读文本与写入计划不一致。", "tavern") };
    }
    const originalDispatch = context.request && isRecord(context.request)
      ? context.request.dispatchContext
      : null;
    if (!isEraDispatchContextV2(originalDispatch) && !isEraDispatchContextV3(originalDispatch)) {
      return { route: "failed", context, error: failure("ERA_API_DISPATCH_CONTEXT_INVALID", "原始派发上下文损坏。", "domain") };
    }
    const dispatchContext = {
      ...originalDispatch,
      messages: cloneEraPortableJsonV1(messages),
      ...(isEraDispatchContextV3(originalDispatch)
        ? {
            processingMessage:
              originalDispatch.processingMessage?.messageId === context.messageId
                ? {
                    ...originalDispatch.processingMessage,
                    activeText: context.committedContent,
                  }
                : originalDispatch.processingMessage,
            stagedMessageUpdates: [
              ...originalDispatch.stagedMessageUpdates.filter(
                (update) => update.messageId !== context.messageId,
              ),
              {
                messageId: Number(context.messageId),
                content: String(context.committedContent),
              },
            ],
          }
        : {}),
    };
    if (!isEraDispatchContextV2(dispatchContext) && !isEraDispatchContextV3(dispatchContext)) {
      return { route: "failed", context, error: failure("ERA_API_DISPATCH_CONTEXT_INVALID", "提交后消息无法形成同步上下文。", "domain") };
    }
    return { route: "sync", context: { ...context, messages, dispatchContext } };
  } catch (error) {
    return { route: "failed", context, error: failure("ERA_API_POST_COMMIT_READ_FAILED", errorMessage(error), "tavern") };
  }
}

export function prepareCommitSync(verified: unknown) {
  if (!isRecord(verified) || !isRecord(verified.request) || !isRecord(verified.dispatchContext)) {
    throw new TypeError("即时同步步骤缺少提交后上下文。");
  }
  const request = requireRequest(verified.request);
  const task: EraSyncTaskV1 = {
    id: `${request.task.id}:state-commit`,
    sourceEvents: request.task.sourceEvents,
    primaryEvent: request.task.primaryEvent,
    context: "latest-message-with-mk",
    kind: "sync",
    reason: "facade-commit",
    target: { kind: "message", messageId: Number(verified.messageId), stopAfterTarget: false },
    fullRebuild: false,
  };
  return {
    syncStep: {
      kind: "execute",
      stepId: `${request.task.id}:state-commit`,
      index: 0,
      taskRoute: "sync",
      sourceSequences: request.sources.map((source) => source.event.sequence),
      events: request.sources.map((source) => source.event),
      task,
      sources: request.sources,
      dispatchContext: verified.dispatchContext,
    },
    context: verified,
  };
}

export function buildSkippedResult(context: unknown): EraTaskResultV1 {
  if (!isRecord(context) || !isRecord(context.request) || !isRecord(context.executionState)) {
    throw new TypeError("skipped receipt 缺少请求或执行状态。");
  }
  const request = requireRequest(context.request);
  const execution = context.executionState as unknown as BatchExecutionStateV1;
  return {
    status: "no-op",
    settlements: settlements(request, "completed", {
      status: "skipped",
      scope: String(context.scope),
      messageId: Number(isRecord(context.latest) ? context.latest.messageId : -1),
    }),
    notifications: [],
    diagnostics: [],
    stateUpdate: stateUpdate(execution, context.window as unknown as ScopeWindowState),
  };
}

export function buildFailureResult(candidate: unknown): EraTaskResultV1 {
  if (!isRecord(candidate) || !isRecord(candidate.context)) {
    throw new TypeError("Commit 失败上下文损坏。");
  }
  const context = candidate.context;
  const request = requireRequest(context.request);
  const execution = context.executionState as unknown as BatchExecutionStateV1;
  const failed = isRecord(candidate.error)
    ? candidate.error as unknown as EraFailureV1
    : failure("ERA_API_COMMIT_FAILED", "ERA.commit 失败。");
  return {
    status: "failed",
    settlements: settlements(request, "failed", failed),
    notifications: [],
    diagnostics: [{ code: failed.code, message: failed.message, sequence: request.task.primaryEvent.sequence }],
    stateUpdate: stateUpdate(execution, context.window as unknown as ScopeWindowState),
  };
}

export function buildCommittedResult(syncResult: EraTaskResultV1, context: unknown): EraTaskResultV1 {
  if (!isRecord(context) || !isRecord(context.request) || !isRecord(context.executionState)) {
    throw new TypeError("committed receipt 缺少请求上下文。");
  }
  if (syncResult.status !== "committed" && syncResult.status !== "no-op") {
    return { ...syncResult, notifications: [] };
  }
  const request = requireRequest(context.request);
  const execution = context.executionState as unknown as BatchExecutionStateV1;
  return {
    ...syncResult,
    settlements: settlements(request, "completed", {
      status: "committed",
      scope: String(context.scope),
      messageId: Number(context.messageId),
    }),
    notifications: [],
    stateUpdate: stateUpdate(execution, context.window as unknown as ScopeWindowState),
  };
}

export function planFacadeSync(rawRequest: unknown) {
  const request = requireRequest(rawRequest);
  const detail = request.detail;
  const mode = detail.mode ?? "auto";
  let target: EraSyncTaskV1["target"];
  let fullRebuild = false;
  if (Number.isSafeInteger(detail.rollbackTo) && Number(detail.rollbackTo) >= 0) {
    target = { kind: "message", messageId: Number(detail.rollbackTo), stopAfterTarget: true };
  } else if (mode === "full") {
    target = { kind: "auto" };
    fullRebuild = true;
  } else if (mode === "latest") {
    target = { kind: "auto" };
  } else if (mode === "auto" || mode === undefined) {
    target = { kind: "auto" };
  } else {
    return { route: "failed", request, error: failure("ERA_API_SYNC_MODE_INVALID", "sync mode 只允许 auto、latest、full 或 rollbackTo。") };
  }
  const task: EraSyncTaskV1 = {
    id: `${request.task.id}:facade-sync`,
    sourceEvents: request.task.sourceEvents,
    primaryEvent: request.task.primaryEvent,
    context: "latest-message-with-mk",
    kind: "sync",
    reason: "manual",
    target,
    fullRebuild,
  };
  return {
    route: "sync",
    request,
    syncStep: {
      kind: "execute",
      stepId: `${request.task.id}:facade-sync`,
      index: 0,
      taskRoute: "sync",
      sourceSequences: request.sources.map((source) => source.event.sequence),
      events: request.sources.map((source) => source.event),
      task,
      sources: request.sources,
      dispatchContext: request.dispatchContext,
    },
  };
}

export function adaptSyncResult(syncResult: EraTaskResultV1, planned: unknown): EraTaskResultV1 {
  if (!isRecord(planned) || !isRecord(planned.request)) throw new TypeError("同步结果缺少 Facade 请求。");
  if (syncResult.status !== "committed" && syncResult.status !== "no-op") return { ...syncResult, notifications: [] };
  const request = requireRequest(planned.request);
  return {
    ...syncResult,
    settlements: settlements(request, "completed", { status: "committed" }),
    notifications: [],
  };
}

export function buildSyncFailure(planned: unknown): EraTaskResultV1 {
  if (!isRecord(planned) || !isRecord(planned.request)) throw new TypeError("同步失败缺少 Facade 请求。");
  const request = requireRequest(planned.request);
  const failed = isRecord(planned.error) ? planned.error as unknown as EraFailureV1 : failure("ERA_API_SYNC_FAILED", "ERA.sync 失败。");
  return {
    status: "failed",
    settlements: settlements(request, "failed", failed),
    notifications: [],
    diagnostics: [{ code: failed.code, message: failed.message, sequence: request.task.primaryEvent.sequence }],
  };
}

export function mergeExclusiveResults(values: readonly EraTaskResultV1[]): EraTaskResultV1 {
  if (values.length !== 1) throw new TypeError(`公共 Facade 分支必须且只能产生一个结果，实际 ${values.length} 个。`);
  return values[0]!;
}
