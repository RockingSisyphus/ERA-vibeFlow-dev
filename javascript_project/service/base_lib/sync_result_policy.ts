import { type PlannedStepV1, type TaskResultV1 } from "./service_types.ts";
import {
  assertSyncStep,
  type SyncFailureV1,
  syncFailure,
  type SyncWorkV1,
  type SyncCommitContractFailureV1,
  type SyncCommitResultV1,
} from "./sync_contracts.ts";
import { type EraSyncPlanV1 } from "./domain/sync_engine.ts";

/** Host 收到后必须在步骤之外执行函数，再以 `era.message.invoke_continue` 恢复。 */
export const MESSAGE_FUNCTION_INVOKE_REQUIRED = "era.message.invoke_required";

export function sourceKey(eventId: string, sequence: number): string {
  return `${eventId}\u0000${sequence}`;
}

export function assertUniqueSources(step: PlannedStepV1): void {
  const valid = assertSyncStep(step);
  if (valid.kind !== "execute") throw new TypeError("同步步骤不是 execute。");
  const seen = new Set<string>();
  for (const source of valid.sources) {
    const key = sourceKey(source.event.eventId, source.event.sequence);
    if (seen.has(key)) throw new TypeError("同步步骤包含重复来源。");
    seen.add(key);
  }
}

export function diagnosticsForPlan(
  plan: EraSyncPlanV1 | null,
  step: PlannedStepV1,
) {
  const sequence =
    step.kind === "execute" ? step.task.primaryEvent.sequence : null;
  return (plan?.diagnostics ?? []).map((item) => ({
    code: item.code,
    message:
      item.messageIndex === null
        ? item.message
        : `${item.message}（消息索引 ${item.messageIndex}）`,
    sequence,
  }));
}

export function stateUpdateForPlan(plan: EraSyncPlanV1 | null) {
  const next = plan?.nextConsecutiveState;
  return next === null || next === undefined
    ? undefined
    : {
        consecutiveMk: next.mk,
        consecutiveProcessingCount: next.count,
      };
}

/**
 * 把工作项上的交接与附加通知投影为 Host 后置通知。
 *
 * 函数交接必须走既有的 notification 通道：它只在新批次里恢复，不能占用当前
 * FIFO，也不能凭空多出第二套回调口。
 */
function notificationsForWork(work: SyncWorkV1) {
  const handoff = work.handoff;
  return [
    ...(handoff === undefined
      ? []
      : [
          {
            type: MESSAGE_FUNCTION_INVOKE_REQUIRED,
            args: [{ kind: "json" as const, value: handoff as never }],
          },
        ]),
    ...(work.notifications ?? []).map((item) => ({
      type: item.type,
      args: item.args.map((value) => ({ kind: "json" as const, value: value as never })),
    })),
  ];
}

export function settlementsFor(
  step: PlannedStepV1,
  status: "committed" | "no-op" | "failed" | "fatal",
  failure: SyncFailureV1 | null,
) {
  assertUniqueSources(step);
  if (step.kind !== "execute") return [];
  return step.sources.map((source) => {
    if (status === "committed" || status === "no-op") {
      return {
        eventId: source.event.eventId,
        sequence: source.event.sequence,
        status: "completed" as const,
        taskId: step.task.id,
        relation: source.relation,
      };
    }
    const error =
      failure ??
      syncFailure(
        "ERA_SYNC_UNKNOWN_FAILURE",
        "同步任务失败但没有错误详情。",
        "domain",
      );
    if (error.category === "cancelled" && status !== "fatal") {
      return {
        eventId: source.event.eventId,
        sequence: source.event.sequence,
        status: "cancelled" as const,
        reason: error.message,
      };
    }
    return {
      eventId: source.event.eventId,
      sequence: source.event.sequence,
      status: "failed" as const,
      error,
    };
  });
}

/** 构造无写入分支的最终结果。 */
export function buildSyncNonCommitResult(work: SyncWorkV1): TaskResultV1 {
  if (work.disposition === "commit") {
    throw new TypeError("commit 工作项不能走无提交结果分支。");
  }
  const status = work.disposition === "no-op" ? "no-op" : "failed";
  const diagnostics = [
    ...diagnosticsForPlan(work.plan, work.step),
    ...(work.failure === null
      ? []
      : [
          {
            code: work.failure.code,
            message: work.failure.message,
            sequence:
              work.step.kind === "execute"
                ? work.step.task.primaryEvent.sequence
                : null,
          },
        ]),
  ];
  return {
    status,
    settlements: settlementsFor(work.step, status, work.failure),
    notifications: notificationsForWork(work),
    diagnostics,
    ...(stateUpdateForPlan(work.plan) === undefined
      ? {}
      : { stateUpdate: stateUpdateForPlan(work.plan) }),
  };
}

/** 把预提交合同失败转换为无副作用、逐来源结算的同步失败。 */
export function buildSyncContractFailureResult(
  candidate: SyncCommitContractFailureV1,
): TaskResultV1 {
  const step = assertSyncStep(candidate.step);
  const failure = candidate.failure;
  return {
    status: "failed",
    settlements: settlementsFor(step, "failed", failure),
    notifications: [],
    diagnostics: [
      {
        code: failure.code,
        message: failure.message,
        sequence: step.task.primaryEvent.sequence,
      },
    ],
  };
}

/** 只在全部消息与 Sidecar 写入已确认后结算；状态更新通过 runtime snapshot 发布。 */
export function buildSyncCommittedResult(
  outcome: SyncCommitResultV1,
): TaskResultV1 {
  const diagnostics = [
    ...diagnosticsForPlan(outcome.plan, outcome.step),
    ...(outcome.failure === null
      ? []
      : [
          {
            code: outcome.failure.code,
            message: outcome.failure.message,
            sequence:
              outcome.step.kind === "execute"
                ? outcome.step.task.primaryEvent.sequence
                : null,
          },
        ]),
    ...(outcome.presentationDiagnostic === undefined
      ? []
      : [
          {
            code: outcome.presentationDiagnostic.code,
            message: outcome.presentationDiagnostic.message,
            sequence:
              outcome.step.kind === "execute"
                ? outcome.step.task.primaryEvent.sequence
                : null,
          },
        ]),
  ];
  return {
    status: outcome.status,
    settlements: settlementsFor(outcome.step, outcome.status, outcome.failure),
    notifications: [],
    diagnostics,
    ...(outcome.sourceChanged || stateUpdateForPlan(outcome.plan) === undefined
      ? {}
      : { stateUpdate: stateUpdateForPlan(outcome.plan) }),
  };
}
