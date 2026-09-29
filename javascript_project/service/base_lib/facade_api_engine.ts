/** Commit and sync receipt rules use the shared Facade request context. */
import {
type EraFailureV1,
type EraSyncTaskV1,
type EraTaskResultV1
} from "@era/vibeflow-contracts";
import {
errorMessage,
failure,
isOperationName,isRecord,
normalizeOperations,
normalizeScope,
operationTag,
readLifecycleToken,
requireRequest,
sameIdentity,
scopeCode,
settlements,
stateUpdate,
type FacadeScope,type OperationName,type ScopeWindowState,
} from "./facade_api_context.ts";
import type { BatchExecutionStateV1 } from "./service_types.ts";
export * from "./facade_api_context.ts";

export function validateCommit(inspected: unknown) {
  if (!isRecord(inspected)) throw new TypeError("窗口读取上下文损坏。");
  const request = requireRequest(inspected.request);
  try {
    if (isRecord(inspected.readFailure))
      return {
        route: "failed",
        context: inspected,
        error: inspected.readFailure,
      };
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
    if (
      !Number.isSafeInteger(requestedToken) ||
      Number(requestedToken) !== currentToken
    ) {
      return {
        route: "failed",
        context: inspected,
        error: failure(
          "ERA_API_WINDOW_CHANGED",
          "ERA.commit 入队后 Tavern 生命周期窗口已经变化。",
          "cancelled",
        ),
      };
    }
    const scope = normalizeScope(request.detail.scope);
    if (scope === null) {
      return {
        route: "failed",
        context: inspected,
        error: failure(
          "ERA_API_SCOPE_INVALID",
          "scope 只允许 message、branch 或 always。",
        ),
      };
    }
    const operations = normalizeOperations(request.detail.operations);
    const window = inspected.window as ScopeWindowState;
    const allowed =
      scope === "always" ||
      (scope === "message" ? window.messageAdmission : window.branchAdmission);
    return allowed
      ? { route: "commit", context: { ...inspected, scope, operations } }
      : { route: "skipped", context: { ...inspected, scope, operations } };
  } catch (error) {
    return {
      route: "failed",
      context: inspected,
      error: failure("ERA_API_COMMIT_INVALID", errorMessage(error)),
    };
  }
}

export function buildTransaction(validated: unknown) {
  if (!isRecord(validated) || !Array.isArray(validated.operations)) {
    throw new TypeError("事务构造只接受已准入的 commit。");
  }
  const scope = validated.scope as FacadeScope;
  const content = validated.operations
    .map((operation) => {
      if (!isRecord(operation) || !isOperationName(String(operation.name))) {
        throw new TypeError("已校验操作在事务构造阶段损坏。");
      }
      const tag = operationTag(operation.name as OperationName);
      // JSON strings may contain ERA tags. Escape the delimiter in the shared
      // API writer so saved records round-trip through the ordinary parser.
      const payload = JSON.stringify(operation.payload).replaceAll("<", "\\u003c");
      return `<${tag}>${payload}</${tag}>`;
    })
    .join("");
  return {
    ...validated,
    transaction: `<era_tx s="${scopeCode(scope)}">${content}</era_tx>`,
  };
}

export function buildAppend(transaction: unknown) {
  if (
    !isRecord(transaction) ||
    !isRecord(transaction.latest) ||
    typeof transaction.transaction !== "string"
  ) {
    throw new TypeError("消息追加计划缺少目标或 era_tx。");
  }
  const latest = transaction.latest;
  const id = latest.messageId;
  if (
    !Number.isSafeInteger(id) ||
    Number(id) < 0 ||
    typeof latest.activeText !== "string"
  ) {
    throw new TypeError("最新 AI 消息不是严格文本投影。");
  }
  const content = `${latest.activeText}\n${transaction.transaction}`;
  return {
    ...transaction,
    messageId: Number(id),
    originalContent: latest.activeText,
    committedContent: content,
    capabilityInput: {
      sourceBasis: transaction.sourceBasis,
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
  const request = isRecord(append.request)
    ? requireRequest(append.request)
    : null;
  const sourceRequested =
    request &&
    Object.prototype.hasOwnProperty.call(request.detail, "sourceContext");
  const currentSource = isRecord(currentIdentity)
    ? currentIdentity.statusbarSource
    : null;
  const sourceCurrent =
    !sourceRequested ||
    (isRecord(request!.detail.sourceContext) &&
      isRecord(currentSource) &&
      [
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
      ].every(
        (key) =>
          (request!.detail.sourceContext as Record<string, unknown>)[key] ===
          currentSource[key],
      ));
  return sameIdentity(append.identity, currentIdentity) && sourceCurrent
    ? { route: "current", context: append }
    : {
        route: "changed",
        context: append,
        error: failure(
          "ERA_API_WINDOW_CHANGED",
          "写入前身份或生命周期窗口已经变化。",
          "cancelled",
        ),
      };
}

export function prepareCommitSync(verified: unknown) {
  if (
    !isRecord(verified) ||
    !isRecord(verified.request) ||
    !isRecord(verified.dispatchContext)
  ) {
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
    target: {
      kind: "message",
      messageId: Number(verified.messageId),
      stopAfterTarget: false,
    },
    fullRebuild: false,
  };
  return {
    syncStep: {
      kind: "execute" as const,
      stepId: `${request.task.id}:state-commit`,
      index: 0,
      taskRoute: "sync" as const,
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
  if (
    !isRecord(context) ||
    !isRecord(context.request) ||
    !isRecord(context.executionState)
  ) {
    throw new TypeError("skipped receipt 缺少请求或执行状态。");
  }
  const request = requireRequest(context.request);
  const execution = context.executionState as unknown as BatchExecutionStateV1;
  return {
    status: "no-op",
    settlements: settlements(request, "completed", {
      status: "skipped",
      scope: String(context.scope),
      messageId: Number(
        isRecord(context.latest) ? context.latest.messageId : -1,
      ),
    }),
    notifications: [],
    diagnostics: [],
    stateUpdate: stateUpdate(
      execution,
      context.window as unknown as ScopeWindowState,
    ),
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
    ? (candidate.error as unknown as EraFailureV1)
    : failure("ERA_API_COMMIT_FAILED", "ERA.commit 失败。");
  return {
    status: "failed",
    settlements: settlements(request, "failed", failed),
    notifications: [],
    diagnostics: [
      {
        code: failed.code,
        message: failed.message,
        sequence: request.task.primaryEvent.sequence,
      },
    ],
    stateUpdate: stateUpdate(
      execution,
      context.window as unknown as ScopeWindowState,
    ),
  };
}

export function buildCommittedResult(
  syncResult: EraTaskResultV1,
  context: unknown,
): EraTaskResultV1 {
  if (
    !isRecord(context) ||
    !isRecord(context.request) ||
    !isRecord(context.executionState)
  ) {
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
    stateUpdate: stateUpdate(
      execution,
      context.window as unknown as ScopeWindowState,
    ),
  };
}

export function planFacadeSync(rawRequest: unknown) {
  const request = requireRequest(rawRequest);
  const detail = request.detail;
  const mode = detail.mode ?? "auto";
  let target: EraSyncTaskV1["target"];
  let fullRebuild = false;
  if (
    Number.isSafeInteger(detail.rollbackTo) &&
    Number(detail.rollbackTo) >= 0
  ) {
    target = {
      kind: "message",
      messageId: Number(detail.rollbackTo),
      stopAfterTarget: true,
    };
  } else if (mode === "full") {
    target = { kind: "auto" };
    fullRebuild = true;
  } else if (mode === "latest") {
    target = { kind: "auto" };
  } else if (mode === "auto" || mode === undefined) {
    target = { kind: "auto" };
  } else {
    return {
      route: "failed",
      request,
      error: failure(
        "ERA_API_SYNC_MODE_INVALID",
        "sync mode 只允许 auto、latest、full 或 rollbackTo。",
      ),
    };
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

export function adaptSyncResult(
  syncResult: EraTaskResultV1,
  planned: unknown,
): EraTaskResultV1 {
  if (!isRecord(planned) || !isRecord(planned.request))
    throw new TypeError("同步结果缺少 Facade 请求。");
  if (syncResult.status !== "committed" && syncResult.status !== "no-op")
    return { ...syncResult, notifications: [] };
  const request = requireRequest(planned.request);
  return {
    ...syncResult,
    settlements: settlements(request, "completed", { status: "committed" }),
    notifications: [],
  };
}

export function buildSyncFailure(planned: unknown): EraTaskResultV1 {
  if (!isRecord(planned) || !isRecord(planned.request))
    throw new TypeError("同步失败缺少 Facade 请求。");
  const request = requireRequest(planned.request);
  const failed = isRecord(planned.error)
    ? (planned.error as unknown as EraFailureV1)
    : failure("ERA_API_SYNC_FAILED", "ERA.sync 失败。");
  return {
    status: "failed",
    settlements: settlements(request, "failed", failed),
    notifications: [],
    diagnostics: [
      {
        code: failed.code,
        message: failed.message,
        sequence: request.task.primaryEvent.sequence,
      },
    ],
  };
}

export function mergeExclusiveResults(
  values: readonly EraTaskResultV1[],
): EraTaskResultV1 {
  if (values.length !== 1)
    throw new TypeError(
      `公共 Facade 分支必须且只能产生一个结果，实际 ${values.length} 个。`,
    );
  return values[0]!;
}
