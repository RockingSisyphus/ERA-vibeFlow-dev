import { type EraSyncCursorV1, type PlannedStepV1, type TaskResultV1 } from "./service_types.ts";
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

/**
 * 把计划的连续处理事实（以及可选的块游标）投影为任务状态更新。
 *
 * 游标必须能区分「本次没带」与「显式清空」：逐块提交时它随每个块前进，楼层算完时被显式
 * 置回 null；若把清空表达成 `undefined`，宿主会保留旧游标，下一个批次就从错误的块继续。
 */
export function stateUpdateForPlan(
  plan: EraSyncPlanV1 | null,
  syncCursor?: EraSyncCursorV1 | null,
) {
  const next = plan?.nextConsecutiveState;
  const withCursor = syncCursor === undefined ? {} : { syncCursor };
  return next === null || next === undefined
    ? Object.keys(withCursor).length === 0
      ? undefined
      : { consecutiveMk: null, consecutiveProcessingCount: 0, ...withCursor }
    : {
        consecutiveMk: next.mk,
        consecutiveProcessingCount: next.count,
        ...withCursor,
      };
}

/**
 * 把工作项上的交接与附加通知投影为 Host 后置通知。
 *
 * 函数交接必须走既有的 notification 通道：它只在新批次里恢复，不能占用当前
 * FIFO，也不能凭空多出第二套回调口。
 */
function handoffNotification(handoff: SyncWorkV1["handoff"]) {
  return handoff === undefined
    ? []
    : [
        {
          type: MESSAGE_FUNCTION_INVOKE_REQUIRED,
          args: [{ kind: "json" as const, value: handoff as never }],
        },
      ];
}

function notificationsForWork(work: SyncWorkV1) {
  return [
    ...handoffNotification(work.handoff),
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
  // 逐块提交的楼层由循环体写入，尾链只剩「结算 + 把续做点/连续处理事实交回批次状态」：
  // 工作项带 `syncCursor` 时，即使它声明不提交，也必须把游标（含显式 null = 楼层算完、
  // 清空续做点）投影成任务状态更新。plan 为空时没有连续处理事实可发布，保持原样。
  const carriesCursor = Object.prototype.hasOwnProperty.call(work, "syncCursor");
  const presents =
    Object.prototype.hasOwnProperty.call(work, "initialPresentation") &&
    (work.initialPresentation ?? null) !== null;
  const cursorUpdate =
    carriesCursor && work.plan !== null && work.plan.status !== "failed"
      ? stateUpdateForPlan(work.plan, work.syncCursor ?? null)
      : stateUpdateForPlan(work.plan);
  return {
    status,
    settlements: settlementsFor(work.step, status, work.failure),
    notifications: notificationsForWork(work),
    diagnostics,
    ...(cursorUpdate === undefined ? {} : { stateUpdate: cursorUpdate }),
    // 收尾呈现意图随结果往下传；呈现节点对「非提交但带意图」的结果也刷新一次。
    ...(presents ? { initialPresentation: work.initialPresentation ?? null } : {}),
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
  // 只有请求里真的带了游标键才更新它：`syncCursor: null` 是「楼层算完、清空续做点」，
  // 而完全没有这个键是「本次不涉及游标」，两者语义不同。
  const carriesCursor = Object.prototype.hasOwnProperty.call(outcome, "syncCursor");
  const stateUpdate = stateUpdateForPlan(
    outcome.plan,
    carriesCursor ? outcome.syncCursor ?? null : undefined,
  );
  return {
    status: outcome.status,
    settlements: settlementsFor(outcome.step, outcome.status, outcome.failure),
    // 交接提交也走提交分支，因此交接通知必须由这里发出；否则函数不会被执行，
    // 工作流会停在调用块上永不前进。
    notifications: handoffNotification(outcome.handoff),
    diagnostics,
    ...(outcome.sourceChanged || stateUpdate === undefined ? {} : { stateUpdate }),
  };
}
