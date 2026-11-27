import {
  unwrapSuccessful,
  isRecord,
  assertSyncStep,
  dispatchContext,
  type DispatchContext,
  type SyncPayloadV1,
  type SyncContextV1,
  type SyncPlanningInput,
  type SyncConsecutiveFacts,
  type SyncWorkV1,
  syncFailure,
  variablesRecord,
  cloneSyncJson,
  isPlainRecord,
  successfulPlan,
  errorMessage,
} from "./sync_contracts.ts";
import { readMessageKey, type EraMkMessageV1, type EraMkSeedV1 } from "../domain/mk_engine.ts";
import { type PlannedStepV1 } from "../service_types.ts";
import type {
  EraActionsTakenV1,
  EraSyncPlanV1,
  EraSyncMessageUpdateV1,
} from "../domain/sync/sync_types.ts";
import { prepareEraSync } from "../domain/sync/sync_prepare.ts";

export function messageArray(value: unknown, depth = 0): readonly unknown[] {
  const unwrapped = unwrapSuccessful(value);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (!isRecord(unwrapped) || depth > 4) {
    throw new TypeError("消息读取结果不是数组。");
  }
  for (const key of ["messages", "value", "data", "chat"]) {
    const nested = unwrapped[key];
    if (Array.isArray(nested)) return nested;
    if (isRecord(nested)) return messageArray(nested, depth + 1);
  }
  throw new TypeError("消息读取结果缺少 messages 数组。");
}

export function normalizeMessage(
  value: unknown,
  index: number,
): EraMkMessageV1 {
  if (!isRecord(value)) throw new TypeError(`消息 #${index} 不是对象。`);
  if (value.schemaVersion !== 2)
    throw new TypeError(`消息 #${index} 缺少严格投影版本。`);
  const rawId = value.messageId;
  if (!Number.isSafeInteger(rawId) || Number(rawId) < 0) {
    throw new TypeError(`消息 #${index} 缺少非负整数 message_id。`);
  }
  if (
    typeof value.role !== "string" ||
    value.role.length === 0 ||
    typeof value.activeText !== "string"
  ) {
    throw new TypeError(`消息 #${index} 缺少角色或当前激活文本。`);
  }
  return {
    messageId: Number(rawId),
    role: value.role,
    content: { kind: "text", text: value.activeText },
  };
}

export function stableBase36Token(source: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, "0");
}

export function seedFor(
  step: PlannedStepV1,
  message: EraMkMessageV1,
  index: number,
): EraMkSeedV1 {
  const task = assertSyncStep(step).task;
  if (task.kind !== "sync") throw new TypeError("同步种子收到非同步任务。");
  const timestamp = Math.max(0, Math.trunc(task.primaryEvent.occurredAt));
  return {
    timestamp,
    token: stableBase36Token(
      `${task.primaryEvent.eventId}:${task.primaryEvent.sequence}:${message.messageId}:${index}`,
    ),
  };
}

export function targetIndex(
  step: PlannedStepV1,
  messages: readonly EraMkMessageV1[],
): { readonly targetMessageId?: number; readonly stopAtTarget: boolean } {
  const task = assertSyncStep(step).task;
  if (task.kind !== "sync") throw new TypeError("同步目标收到非同步任务。");
  if (task.target.kind === "auto") return { stopAtTarget: false };
  if (task.target.kind === "previous-of-latest") {
    const previous = messages.length - 2;
    return previous < 0
      ? { stopAtTarget: false }
      : { targetMessageId: previous, stopAtTarget: true };
  }
  const target = task.target;
  const index = messages.findIndex(
    (message) => message.messageId === target.messageId,
  );
  return {
    targetMessageId: index < 0 ? target.messageId : index,
    stopAtTarget: target.stopAfterTarget,
  };
}

export function actionsForStep(
  step: PlannedStepV1,
  actions: EraActionsTakenV1,
): EraActionsTakenV1 {
  const task = assertSyncStep(step).task;
  if (task.kind !== "sync") throw new TypeError("同步动作收到非同步任务。");
  const isApi = dispatchContext(step).dispatchClass === "api";
  return {
    ...actions,
    api: isApi,
  };
}

export function applyDispatchStatePolicy(
  plan: EraSyncPlanV1,
  step: PlannedStepV1,
  state: SyncConsecutiveFacts,
): EraSyncPlanV1 {
  const context = dispatchContext(step);
  if (context.dispatchClass !== "api") return plan;
  return {
    ...plan,
    consecutiveProcessingCount: 1,
    nextConsecutiveState: {
      mk: state.mk,
      count: state.count,
    },
  } as EraSyncPlanV1;
}

export function normalizePlan(
  plan: EraSyncPlanV1,
  preUpdates: readonly EraSyncMessageUpdateV1[],
  step: PlannedStepV1,
): EraSyncPlanV1 {
  if (plan.status === "failed") return plan;
  return {
    ...plan,
    committed: plan.committed || preUpdates.length > 0,
    actionsTaken: actionsForStep(step, plan.actionsTaken),
    messageUpdates: [...preUpdates, ...plan.messageUpdates],
  } as EraSyncPlanV1;
}

export function payloadFor(
  step: PlannedStepV1,
  plan: Exclude<EraSyncPlanV1, { readonly status: "failed" }>,
  processingMessage: DispatchContext["processingMessage"],
  processingMk: string | null,
): SyncPayloadV1 {
  if (processingMessage === null) {
    throw new TypeError("同步公开 payload 缺少不可变 processing message。");
  }
  const count = plan.consecutiveProcessingCount;
  if (!Number.isSafeInteger(count) || Number(count) < 1) {
    throw new TypeError("同步计划缺少有效的连续处理次数。");
  }
  return {
    mk: processingMk ?? "",
    message_id: processingMessage.messageId,
    is_user: processingMessage.role === "user",
    actions: actionsForStep(step, plan.actionsTaken),
    consecutiveProcessingCount: Number(count),
  };
}

/** 从两个 Capability 读取结果生成唯一、无副作用的同步工作项。 */
export function planSyncWork(
  context: SyncPlanningInput,
): SyncWorkV1 {
  const step = assertSyncStep(context.step);
  if (context.status === "failed") {
    return {
      schemaVersion: 1,
      step,
      disposition: "failed",
      plan: null,
      payload: null,
      failure:
        context.failure ??
        syncFailure(
          "ERA_SYNC_CONTEXT_FAILED",
          "同步上下文读取失败但没有错误详情。",
          "tavern",
        ),
    };
  }
  const state = context.consecutive;
  try {
    const prepared = dispatchContext(step);
    if (prepared.status !== "ready") {
      throw new TypeError(
        prepared.failure?.message ?? "统一派发上下文不可用。",
      );
    }
    if (
      prepared.messages.length > 0 &&
      prepared.requirement === "latest-message-with-mk" &&
      (typeof prepared.processingMk !== "string" ||
        prepared.processingMk.length === 0)
    ) {
      throw new TypeError(
        "latest-message-with-mk 同步任务缺少非空 processing MK。",
      );
    }
    const variables = variablesRecord(context.variablesRaw);
    const stat = cloneSyncJson(variables.stat_data ?? variables.stat ?? {});
    const statFuncCandidate = variables.statFunc ?? {};
    if (!isPlainRecord(statFuncCandidate)) {
      throw new TypeError("Sidecar statFunc 不是对象。");
    }
    const statFunc = cloneSyncJson(statFuncCandidate);
    const metaCandidate = variables.ERAMetaData ?? variables.meta ?? {};
    if (!isRecord(metaCandidate)) {
      throw new TypeError("ERAMetaData 不是对象。");
    }
    const meta = cloneSyncJson(metaCandidate);
    const messages = messageArray(context.messagesRaw).map(normalizeMessage);
    if (messages.length === 0) {
      const plan = prepareEraSync({
        messages: [],
        stat,
        statFunc,
        meta,
        reason: step.task.kind === "sync" ? step.task.reason : "manual",
        processingMk: prepared.processingMk,
        consecutiveState: {
          mk: state.mk,
          count: state.count,
        },
      });
      return {
        schemaVersion: 1,
        step,
        disposition: plan.committed ? "commit" : "no-op",
        plan,
        payload: null,
        failure: null,
      };
    }

    const task = step.task;
    if (task.kind !== "sync") throw new TypeError("同步计划收到非同步任务。");
    const preparedMessages = [...messages];
    const preUpdates: EraSyncMessageUpdateV1[] =
      prepared.schemaVersion === 3
        ? prepared.stagedMessageUpdates.map((update) => {
            const messageIndex = preparedMessages.findIndex(
              (message) => message.messageId === update.messageId,
            );
            const mk=messageIndex<0?null:readMessageKey({...preparedMessages[messageIndex]!,content:{kind:'text',text:update.content}});
            if (messageIndex < 0 || mk === null) {
              throw new TypeError(
                "暂存消息更新缺少可验证的消息位置或 processing MK。",
              );
            }
            return {
              kind: "update-message-content" as const,
              messageId: update.messageId,
              messageIndex,
              mk,
              content: { kind: "text" as const, text: update.content },
            };
          })
        : [];
    const processingMessage = prepared.processingMessage;
    const processingMk = prepared.processingMk;
    if (processingMessage === null) {
      throw new TypeError("同步任务缺少不可变 processing message。");
    }
    const processingMatches = preparedMessages.filter(
      (message) => message.messageId === processingMessage.messageId,
    );
    if (processingMatches.length !== 1) {
      throw new TypeError("当前消息快照必须唯一包含 processing message。");
    }

    const target = targetIndex(step, preparedMessages);
    const seeds = preparedMessages.map((message, index) =>
      seedFor(step, message, index),
    );
    const planned = applyDispatchStatePolicy(
      normalizePlan(
        prepareEraSync({
          messages: preparedMessages,
          stat,
          statFunc,
          meta,
          reason: task.reason,
          forceFullRebuild: task.fullRebuild,
          targetMessageId: target.targetMessageId,
          stopAtTarget: target.stopAtTarget,
          mkSeedsByIndex: seeds,
          processingMk,
          consecutiveState: {
            mk: state.mk,
            count: state.count,
          },
        }),
        preUpdates,
        step,
      ),
      step,
      state,
    );
    if (planned.status === "failed") {
      return {
        schemaVersion: 1,
        step,
        disposition: "failed",
        plan: planned,
        payload: null,
        failure: syncFailure(
          planned.error.code,
          planned.error.message,
          "domain",
        ),
      };
    }
    const payload = payloadFor(
      step,
      successfulPlan(planned),
      processingMessage,
      processingMk,
    );
    return {
      schemaVersion: 1,
      step,
      disposition: planned.committed ? "commit" : "no-op",
      plan: planned,
      payload,
      failure: null,
    };
  } catch (error) {
    return {
      schemaVersion: 1,
      step,
      disposition: "failed",
      plan: null,
      payload: null,
      failure: syncFailure(
        "ERA_SYNC_PLAN_FAILED",
        errorMessage(error),
        "input",
      ),
    };
  }
}

/** 从存储编排输入提取同步计算事实，不把批次状态或 Sidecar 流程附加字段交给算法。 */
export function prepareSyncPlanningInput(
  context: SyncContextV1,
): SyncPlanningInput {
  return {
    step: context.step,
    consecutive: { ...context.consecutive },
    status: context.status,
    messagesRaw: context.messagesRaw,
    variablesRaw: context.variablesRaw,
    failure: context.failure,
  };
}
