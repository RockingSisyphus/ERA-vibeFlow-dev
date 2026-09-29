/** Pure Sidecar resolution projections; capability calls remain in the Node. */
import { sidecarSourceBasis, type SidecarFactsV1, type SidecarStateV2, type SyncContextV1 } from "./sidecar_binding.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * `era.tavern.variables.read` 的正式返回值是 `{ scope, variables }`。Sidecar
 * 事务必须和同步引擎使用同一层实际聊天变量；同时保留对直接变量对象的兼容，便于
 * 纯节点单测而不把宿主包装泄漏为另一套业务模型。
 */
export function variablesFromSync(sync: SyncContextV1): Record<string, unknown> {
  if (!isRecord(sync.variablesRaw))
    throw new TypeError("当前同步上下文缺少聊天变量。");
  if (isRecord(sync.variablesRaw.variables)) return sync.variablesRaw.variables;
  // Sidecar store 的入口故意只读宿主的 `{ identity, meta, stat }` 事实，
  // 而不是直接把整份 chat variables 交给同步路径。事务内部仍需要构造一次
  // 临时变量投影，以便给既有纯同步/恢复逻辑传递 SidecarId；这个投影不写回
  // Tavern，也不构成状态回退来源。
  if (
    Object.prototype.hasOwnProperty.call(sync.variablesRaw, "identity") &&
    (sync.variablesRaw.meta === null || isRecord(sync.variablesRaw.meta))
  ) {
    const variables: Record<string, unknown> = {};
    if (isRecord(sync.variablesRaw.meta))
      variables.ERAMetaData = sync.variablesRaw.meta;
    if (
      sync.variablesRaw.stat !== null &&
      Object.prototype.hasOwnProperty.call(sync.variablesRaw, "stat")
    ) {
      variables.stat_data = sync.variablesRaw.stat;
    }
    return variables;
  }
  return sync.variablesRaw;
}

export function withVariables(
  sync: SyncContextV1,
  variables: Record<string, unknown>,
): SyncContextV1 {
  if (isRecord(sync.variablesRaw) && isRecord(sync.variablesRaw.variables)) {
    return { ...sync, variablesRaw: { ...sync.variablesRaw, variables } };
  }
  return { ...sync, variablesRaw: variables };
}

/** 将已经落盘的本次恢复纳入依据，并移除已经完成的暂存消息写入。 */
export function withAppendedRestore(
  sync: SyncContextV1,
  messageId: number,
  content: string,
): SyncContextV1 {
  const raw = sync.messagesRaw as { messages: Array<Record<string, unknown>> };
  const update = (message: Record<string, unknown>) =>
    message.messageId === messageId
      ? { ...message, activeText: content }
      : message;
  const messages = raw.messages.map(update);
  const step = sync.step as Record<string, unknown>;
  const dispatch = step.dispatchContext as Record<string, unknown>;
  const basis = sidecarSourceBasis(sync);
  const sourceBasis = {
    ...basis,
    messages: basis.messages.map((message) =>
      message.messageId === messageId
        ? { ...message, activeText: content }
        : message,
    ),
  };
  return {
    ...sync,
    messagesRaw: { ...raw, messages },
    step: {
      ...step,
      dispatchContext: {
        ...dispatch,
        sourceBasis,
        messages,
        processingMessage: isRecord(dispatch.processingMessage)
          ? update(dispatch.processingMessage)
          : null,
        stagedMessageUpdates: Array.isArray(dispatch.stagedMessageUpdates)
          ? dispatch.stagedMessageUpdates.filter(
              (value) => !isRecord(value) || value.messageId !== messageId,
            )
          : [],
      },
    },
  };
}

export function withSidecarId(sync: SyncContextV1, sidecarId: string): SyncContextV1 {
  const variables = variablesFromSync(sync);
  const meta = variables.ERAMetaData as Record<string, unknown>;
  return withVariables(sync, {
    ...variables,
    ERAMetaData: { ...meta, SidecarId: sidecarId },
  });
}

export function stateFromSync(
  sync: SyncContextV1,
  facts: SidecarFactsV1,
): SidecarStateV2 {
  if (facts.legacyState !== null) return facts.legacyState;
  // V1 用户文件没有聊天内 legacy stat_data 时，文件本身就是升级的唯一旧
  // 状态来源。不得把它误降级为空对象，否则一次格式升级会丢失变量。
  if (facts.legacyRecord !== null) {
    return {
      statData: facts.legacyRecord.statData,
      eraMeta: facts.legacyRecord.eraMeta ?? {},
      statFunc: {},
    };
  }
  const value = variablesFromSync(sync);
  const eraMeta = isRecord(value.ERAMetaData) ? { ...value.ERAMetaData } : {};
  delete eraMeta.SidecarId;
  return {
    statData: value.stat_data ?? {},
    eraMeta,
    statFunc: isRecord(value.statFunc) ? { ...value.statFunc } : {},
  };
}
