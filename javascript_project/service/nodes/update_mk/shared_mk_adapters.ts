import {
  type PlannedStepV1,
  type TaskResultV1,
} from "../../base_lib/service_types.ts";

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/update_mk/shared_mk_adapters.ts。 */
// Adapters with identical declared base libraries share this source.

// Original node: nodes/agent/adapt_legacy_step.ts
interface AdaptLegacyStep_Envelope<T> {
  readonly value: T;
}
interface AdaptLegacyStep_Transition {
  readonly step: PlannedStepV1;
}
export function AdaptLegacyStepNode(
  inputs: Readonly<{
    "era.agent.session.transition": AdaptLegacyStep_Envelope<unknown>;
    "era.batch.execution.state": AdaptLegacyStep_Envelope<unknown>;
  }>,
): any {
  const transition = inputs["era.agent.session.transition"]
    .value as AdaptLegacyStep_Transition;
  const executionState = inputs["era.batch.execution.state"].value;
  const step = transition.step;
  if (step.kind !== "execute")
    throw new TypeError("Agent 默认委托只接受 execute 步骤。");
  const context = step.dispatchContext;
  const hasFloorCandidate =
    context !== null &&
    typeof context === "object" &&
    !Array.isArray(context) &&
    (context as Readonly<Record<string, unknown>>).schemaVersion === 3 &&
    (context as Readonly<Record<string, unknown>>).agentFloorCandidate !== null;
  if (hasFloorCandidate && step.task.kind !== "sync") {
    const task = {
      id: step.task.id,
      kind: "sync" as const,
      sourceEvents: step.task.sourceEvents,
      primaryEvent: step.task.primaryEvent,
      context: "latest-message-with-mk" as const,
      reason: "manual" as const,
      target: { kind: "auto" as const },
      fullRebuild: false,
    };
    return {
      legacy_routed_step: { ...step, task, taskRoute: "sync" },
      legacy_task_route: "sync",
      legacy_execution_state: executionState,
    };
  }
  return {
    legacy_routed_step: { ...step, taskRoute: step.task.kind },
    legacy_task_route: step.task.kind,
    legacy_execution_state: executionState,
  };
}

// Original node: nodes/update_mk/build_mk_commit.ts
interface BuildMkCommit_Envelope<T> {
  readonly value: T;
}

interface BuildMkCommit_Candidate {
  readonly step: PlannedStepV1;
  readonly disposition: "ready" | "failed";
  readonly mk: string | null;
  readonly messageUpdate: null | {
    readonly messageId: number;
    readonly content: string;
  };
  readonly metaUpdate: Readonly<Record<string, unknown>> | null;
  readonly messageWriteRequired: boolean;
  readonly variableWriteRequired: boolean;
}

export function BuildMkCommitNode(
  inputs: Readonly<{
    "era.mk.candidate.routed": BuildMkCommit_Envelope<unknown>;
  }>,
): any {
  const candidate = inputs["era.mk.candidate.routed"]
    .value as BuildMkCommit_Candidate;
  if (
    candidate.disposition !== "ready" ||
    candidate.mk === null ||
    candidate.metaUpdate === null ||
    (!candidate.messageWriteRequired && !candidate.variableWriteRequired)
  ) {
    throw new TypeError("MK 提交分支收到不可提交候选。 ");
  }
  if (candidate.messageWriteRequired && candidate.messageUpdate === null) {
    throw new TypeError("MK 消息写入缺少明确文本请求。");
  }
  return {
    mk_commit_request: {
      schemaVersion: 1,
      step: candidate.step,
      mk: candidate.mk,
      messageUpdate: candidate.messageUpdate,
      metaUpdate: candidate.metaUpdate,
      messageWriteRequired: candidate.messageWriteRequired,
      variableWriteRequired: candidate.variableWriteRequired,
    },
  };
}

// Original node: nodes/update_mk/consume_prepared_context.ts
interface ConsumePreparedContext_Envelope<T> {
  readonly value: T;
}
function ConsumePreparedContext_isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function ConsumePreparedContextNode(
  inputs: Readonly<{
    "era.step.request.routed": ConsumePreparedContext_Envelope<unknown>;
  }>,
): any {
  const step = inputs["era.step.request.routed"].value as PlannedStepV1;
  if (step.kind !== "execute" || step.task.kind !== "update-mk") {
    throw new TypeError("统一 MK 结果只接受 update-mk execute 步骤。");
  }
  const prepared = ConsumePreparedContext_isRecord(step.dispatchContext)
    ? step.dispatchContext
    : null;
  const ready = prepared?.status === "ready";
  const failure = ConsumePreparedContext_isRecord(prepared?.failure)
    ? prepared.failure
    : null;
  return {
    prepared_mk_outcome: {
      schemaVersion: 1,
      step,
      status: ready
        ? prepared?.messageChanged === true ||
          prepared?.variablesChanged === true
          ? "committed"
          : "no-op"
        : "failed",
      mk:
        typeof prepared?.processingMk === "string"
          ? prepared.processingMk
          : null,
      messageChanged: prepared?.messageChanged === true,
      variablesChanged: prepared?.variablesChanged === true,
      failure: ready
        ? null
        : (failure ?? {
            code: "ERA_UPDATE_MK_CONTEXT_FAILED",
            message: "统一任务上下文准备失败。",
            category: "domain",
            retryable: false,
          }),
    },
  };
}

// Original node: nodes/update_mk/preserve_mk.ts
interface PreserveMk_Envelope<T> {
  readonly value: T;
}

interface PreserveMk_MkFailure {
  readonly code: string;
  readonly message: string;
  readonly category: "input" | "domain" | "tavern" | "cancelled";
  readonly retryable: false;
}

interface PreserveMk_Candidate {
  readonly step: PlannedStepV1;
  readonly disposition: "ready" | "failed";
  readonly mk: string | null;
  readonly failure: PreserveMk_MkFailure | null;
}

export function PreserveMkNode(
  inputs: Readonly<{ "era.mk.candidate.routed": PreserveMk_Envelope<unknown> }>,
): any {
  const candidate = inputs["era.mk.candidate.routed"]
    .value as PreserveMk_Candidate;
  return {
    mk_noop_outcome: {
      schemaVersion: 1,
      step: candidate.step,
      status: candidate.disposition === "failed" ? "failed" : "no-op",
      mk: candidate.mk,
      messageChanged: false,
      variablesChanged: false,
      failure: candidate.failure,
    },
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/update_mk/build_mk_result.ts。 */
interface buildmkresultEnvelope<T> {
  readonly value: T;
}

interface MkFailure {
  readonly code: string;
  readonly message: string;
  readonly category: "input" | "domain" | "tavern" | "cancelled";
  readonly retryable: false;
}

interface CommitOutcome {
  readonly schemaVersion: 1;
  readonly step: PlannedStepV1;
  readonly status: "committed" | "no-op" | "failed" | "fatal";
  readonly mk: string | null;
  readonly messageChanged: boolean;
  readonly variablesChanged: boolean;
  readonly failure: MkFailure | null;
}

function taskIdentity(step: PlannedStepV1): string {
  if (step.kind !== "execute" || step.task.kind !== "update-mk") {
    throw new TypeError("MK 结果收到非 update-mk execute 步骤。");
  }
  return step.task.id;
}

function sourceKey(eventId: string, sequence: number): string {
  return `${eventId}\u0000${sequence}`;
}

function assertUniqueSources(step: PlannedStepV1): void {
  if (step.kind !== "execute") {
    throw new TypeError("MK 结果只能结算 execute 步骤。");
  }
  const seen = new Set<string>();
  for (const source of step.sources) {
    const key = sourceKey(source.event.eventId, source.event.sequence);
    if (seen.has(key)) {
      throw new TypeError(`MK 步骤含重复来源：${source.event.sequence}。`);
    }
    seen.add(key);
  }
  if (seen.size === 0) throw new TypeError("MK 步骤没有可结算来源。");
}

export function BuildMkResultNode(
  inputs: Readonly<{ "era.mk.commit.result": buildmkresultEnvelope<unknown> }>,
): any {
  const result = inputs["era.mk.commit.result"].value as CommitOutcome;
  const step = result.step;
  assertUniqueSources(step);
  const taskId = taskIdentity(step);
  const taskStatus = result.status;
  const settlements =
    step.kind === "execute"
      ? step.sources.map((source) => {
          if (taskStatus === "committed" || taskStatus === "no-op") {
            return {
              eventId: source.event.eventId,
              sequence: source.event.sequence,
              status: "completed" as const,
              taskId,
              relation: source.relation,
            };
          }
          const error = result.failure ?? {
            code: "ERA_UPDATE_MK_UNKNOWN_FAILURE",
            message: "MK 任务失败但未提供错误详情。",
            category: "domain" as const,
            retryable: false as const,
          };
          if (error.category === "cancelled" && taskStatus !== "fatal") {
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
        })
      : [];

  const diagnostics = [
    {
      code: "ERA_UPDATE_MK_CONSECUTIVE_STATE_UNCHANGED",
      message:
        "消息密钥任务只校准当前激活文本与 SelectedMks，不参与连续 MK 计数。",
      sequence:
        step.kind === "execute" ? step.task.primaryEvent.sequence : null,
    },
    ...(result.failure === null
      ? []
      : [
          {
            code: result.failure.code,
            message: result.failure.message,
            sequence:
              step.kind === "execute" ? step.task.primaryEvent.sequence : null,
          },
        ]),
  ];

  const taskResult: TaskResultV1 = {
    status: taskStatus,
    settlements,
    notifications: [],
    diagnostics,
  };
  return { update_mk_task_result: taskResult };
}
