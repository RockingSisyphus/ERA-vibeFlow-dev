// Adapters with identical declared base libraries share this source.
import { type PlannedStepV1 } from "../../base_lib/service_types.ts";

// Original node: nodes/agent/adapt_legacy_step.ts
interface AdaptLegacyStep_Envelope<T> { readonly value: T; }
interface AdaptLegacyStep_Transition { readonly step: PlannedStepV1; }
export function AdaptLegacyStepNode(inputs: Readonly<{ "era.agent.session.transition": AdaptLegacyStep_Envelope<unknown>; "era.batch.execution.state": AdaptLegacyStep_Envelope<unknown> }>): any {
  const transition = inputs["era.agent.session.transition"].value as AdaptLegacyStep_Transition;
  const executionState = inputs["era.batch.execution.state"].value;
  const step = transition.step;
  if (step.kind !== "execute") throw new TypeError("Agent 默认委托只接受 execute 步骤。");
  const context = step.dispatchContext;
  const hasFloorCandidate = context !== null
    && typeof context === "object"
    && !Array.isArray(context)
    && (context as Readonly<Record<string, unknown>>).schemaVersion === 3
    && (context as Readonly<Record<string, unknown>>).agentFloorCandidate !== null;
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
  return { legacy_routed_step: { ...step, taskRoute: step.task.kind }, legacy_task_route: step.task.kind, legacy_execution_state: executionState };
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
  inputs: Readonly<{ "era.mk.candidate.routed": BuildMkCommit_Envelope<unknown> }>,
): any {
  const candidate = inputs["era.mk.candidate.routed"].value as BuildMkCommit_Candidate;
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
function ConsumePreparedContext_isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function ConsumePreparedContextNode(
  inputs: Readonly<{ "era.step.request.routed": ConsumePreparedContext_Envelope<unknown> }>,
): any {
  const step = inputs["era.step.request.routed"].value as PlannedStepV1;
  if (step.kind !== "execute" || step.task.kind !== "update-mk") {
    throw new TypeError("统一 MK 结果只接受 update-mk execute 步骤。");
  }
  const prepared = ConsumePreparedContext_isRecord(step.dispatchContext) ? step.dispatchContext : null;
  const ready = prepared?.status === "ready";
  const failure = ConsumePreparedContext_isRecord(prepared?.failure) ? prepared.failure : null;
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
  const candidate = inputs["era.mk.candidate.routed"].value as PreserveMk_Candidate;
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
