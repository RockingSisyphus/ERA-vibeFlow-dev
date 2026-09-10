import {
  normalizeAgentConfiguration,
  isAgentEnabled,
} from "./agent_generation_session.ts";
import {
  formatMessageKeyBlock,
  stripEraDataBlocks,
} from "./domain/mk_engine.ts";
import type { PlannedStepV1 } from "./service_types.ts";
import type {
  EraAgentFloorCandidateV1,
  EraDispatchContextV3,
  EraFloorIdentityV1,
} from "@era/vibeflow-contracts";
import type { EraAgentConfigurationV2 } from "./agent_generation_session.ts";
import type {
  GenerationFacts,
  GenerationDecision,
  GenerationRequest,
  AgentDiagnostic,
  AgentOutcome,
} from "./agent_flow_types.ts";
export class AgentSessionFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AgentSessionFailure";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readArg(step: PlannedStepV1, index: number): unknown {
  if (step.kind !== "execute") return undefined;
  const arg = step.task.primaryEvent.args[index];
  return arg?.kind === "json" ? arg.value : undefined;
}

function eventType(step: PlannedStepV1): string {
  return step.kind === "execute" ? step.task.primaryEvent.type : "";
}

function dispatchContextV3(step: PlannedStepV1): EraDispatchContextV3 {
  if (
    step.kind !== "execute" ||
    !isRecord(step.dispatchContext) ||
    step.dispatchContext.schemaVersion !== 3
  ) {
    throw new AgentSessionFailure(
      "ERA_AGENT_DISPATCH_CONTEXT_V3_REQUIRED",
      "Agent 楼层提交缺少稳定身份派发上下文。",
    );
  }
  return step.dispatchContext as unknown as EraDispatchContextV3;
}

function floorIdentity(step: PlannedStepV1): EraFloorIdentityV1 {
  const identity = dispatchContextV3(step).floorIdentity;
  if (identity === null) {
    throw new AgentSessionFailure(
      "ERA_AGENT_FLOOR_IDENTITY_REQUIRED",
      "Agent 楼层候选缺少真实 assistant 楼层身份。",
    );
  }
  return identity;
}

function canonicalFloorContent(
  content: string,
  identity: EraFloorIdentityV1,
  keepStatusPlaceholder: boolean,
): string {
  const story = stripEraDataBlocks(content)
    .replace(/<StatusPlaceHolderImpl\s*\/>/giu, "")
    .trimEnd();
  return [
    story,
    formatMessageKeyBlock(identity.mk, "assistant"),
    keepStatusPlaceholder ? "<StatusPlaceHolderImpl/>" : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function withFloorCandidate(
  step: PlannedStepV1,
  rawCandidate: EraAgentFloorCandidateV1,
): PlannedStepV1 {
  if (step.kind !== "execute") return step;
  const dispatchContext = dispatchContextV3(step);
  const identity = floorIdentity(step);
  if (
    rawCandidate.messageId !== identity.messageId ||
    rawCandidate.swipeId !== identity.swipeId ||
    rawCandidate.mk !== identity.mk
  ) {
    throw new AgentSessionFailure(
      "ERA_FLOOR_IDENTITY_MISMATCH",
      "Agent 最终楼层候选与派发楼层身份不一致。",
    );
  }
  const keepStatusPlaceholder =
    dispatchContext.processingMessage?.activeText.includes(
      "<StatusPlaceHolderImpl/>",
    ) === true;
  const content = canonicalFloorContent(
    rawCandidate.content,
    identity,
    keepStatusPlaceholder,
  );
  const candidate: EraAgentFloorCandidateV1 = {
    ...rawCandidate,
    content,
  };
  const messages = dispatchContext.messages.map((message) =>
    message.messageId === identity.messageId
      ? { ...message, activeText: content }
      : message,
  );
  const processingMessage =
    dispatchContext.processingMessage?.messageId === identity.messageId
      ? { ...dispatchContext.processingMessage, activeText: content }
      : dispatchContext.processingMessage;
  const stagedMessageUpdates = [
    ...dispatchContext.stagedMessageUpdates.filter(
      (update) => update.messageId !== identity.messageId,
    ),
    { messageId: identity.messageId, content },
  ];
  return {
    ...step,
    dispatchContext: {
      ...dispatchContext,
      messages,
      processingMessage,
      stagedMessageUpdates,
      agentFloorCandidate: candidate,
    },
  };
}

function isGroupChat(context: Record<string, unknown>): boolean {
  const identity = isRecord(context.identity) ? context.identity : {};
  return typeof identity.groupId === "string" && identity.groupId.length > 0;
}

function sessionObject(
  context: Record<string, unknown>,
): Record<string, unknown> | null {
  return isRecord(context.session) ? structuredClone(context.session) : null;
}

function sessionConfiguration(
  session: Record<string, unknown> | null,
): EraAgentConfigurationV2 | null {
  return session !== null && isRecord(session.configuration)
    ? normalizeAgentConfiguration(session.configuration)
    : null;
}

function generationKind(step: PlannedStepV1): string {
  const value = readArg(step, 0);
  return typeof value === "string" ? value : "normal";
}
export function collectGenerationFacts(
  step: PlannedStepV1,
  host: unknown,
  diagnostics: readonly AgentDiagnostic[],
): GenerationFacts {
  if (step.kind !== "execute" || step.taskRoute !== "agent-generation-session")
    throw new TypeError("AgentGenerationSession 只接受已包装的 execute 步骤。");
  let identity: EraFloorIdentityV1 | null = null;
  let identityError: AgentDiagnostic | null = null;
  try {
    identity = floorIdentity(step);
  } catch (error) {
    identityError = {
      code:
        error instanceof AgentSessionFailure
          ? error.code
          : "ERA_AGENT_SESSION_FAILED",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  return {
    trigger: {
      eventId: step.task.primaryEvent.eventId,
      sequence: step.task.primaryEvent.sequence,
      cycleIdentity: isRecord(step.dispatchContext)
        ? step.dispatchContext.generationCycleIdentity
        : null,
      type: eventType(step),
      kind: generationKind(step),
      dryRun: readArg(step, 2) === true,
      retry: readArg(step, 0),
    },
    context: isRecord(host)
      ? {
          identity: host.identity,
          state: host.state,
          messages: host.messages,
          latestMessage: host.latestMessage,
          session: host.session,
        }
      : null,
    configuration: normalizeAgentConfiguration(
      isRecord(host) ? host.configuration : null,
    ),
    contextUnavailable: host === null,
    diagnostics,
    identity,
    identityError,
  };
}
export function classifyGeneration(facts: GenerationFacts): GenerationDecision {
  const finish = (
    mode: AgentOutcome["mode"],
    status: AgentOutcome["status"] = "no-op",
    diagnostics: readonly AgentDiagnostic[] = [],
    value?: unknown,
  ): GenerationDecision => ({
    ...facts,
    phase: "finish",
    disposition: {
      mode,
      status,
      diagnostics,
      ...(value === undefined ? {} : { value }),
    },
  });
  if (!facts.context)
    return facts.contextUnavailable
      ? finish("legacy", "no-op", [
          {
            code: "ERA_AGENT_CONTEXT_UNAVAILABLE",
            message: facts.diagnostics[0]?.message ?? "宿主上下文不可用。",
          },
        ])
      : finish("legacy", "failed", [
          {
            code: "ERA_AGENT_CONTEXT_INVALID",
            message: "宿主未返回 Agent 上下文。",
          },
        ]);
  if (facts.trigger.type === "generation_stopped")
    return { ...facts, phase: "cancel" };
  if (isGroupChat(facts.context))
    return finish("legacy", "no-op", [], { status: "group-chat-unsupported" });
  const existing = sessionObject(facts.context),
    frozen = sessionConfiguration(existing);
  const continuing =
    facts.trigger.type === "message_received" ||
    facts.trigger.type === "era.ui.agent_retry" ||
    facts.trigger.type === "era.agent.stage_continue" ||
    (facts.trigger.type === "generation_started" &&
      facts.trigger.kind === "normal");
  const configuration = continuing && frozen ? frozen : facts.configuration;
  if (!isAgentEnabled(configuration)) return finish("legacy");
  if (
    facts.trigger.type === "generation_started" &&
    (facts.trigger.dryRun ||
      ["quiet", "impersonate"].includes(facts.trigger.kind))
  )
    return finish("legacy");
  const phase =
    facts.trigger.type === "era.agent.stage_continue"
      ? "resume"
      : facts.trigger.type === "message_sent" ||
          facts.trigger.type === "generation_started"
        ? "planning"
        : facts.trigger.type === "message_received"
          ? "story"
          : facts.trigger.type === "era.ui.agent_retry"
            ? "retry"
            : "finish";
  return phase === "finish"
    ? finish("legacy")
    : { ...facts, configuration, phase };
}
export function prepareGeneration(
  decision: GenerationDecision,
): GenerationRequest {
  // Freeze the selected message, variable and session facts before the effectful stage.
  // Cancellation and no-op execution do not carry story or variable payloads.
  return {
    phase: decision.phase,
    trigger: decision.trigger,
    configuration: decision.configuration,
    context: decision.context
      ? structuredClone(
          decision.phase === "cancel" || decision.phase === "finish"
            ? {
                ...decision.context,
                state: null,
                messages: [],
                latestMessage: null,
                session: null,
              }
            : decision.context,
        )
      : null,
    identity: decision.identity,
    identityError: decision.identityError,
    ...(decision.disposition ? { disposition: decision.disposition } : {}),
  };
}
