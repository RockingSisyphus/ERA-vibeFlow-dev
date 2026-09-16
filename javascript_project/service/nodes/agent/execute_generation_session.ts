import { parseMessageBlocks } from "../../base_lib/domain/message_function_calls.ts";
import {
  inspectSettlementText,
  splitAgentStageText,
} from "../../base_lib/agent_stage_text.ts";
import {
  AgentStageBoundary,
  stageHandoff,
} from "../../base_lib/agent_stage_handoff.ts";
import {
  prepareSessionWrite,
  type SessionBindingFacts,
} from "../../base_lib/agent_session_binding.ts";
import { buildAgentRequestPolicy } from "../../base_lib/agent_request_policy.ts";
import {
  AgentFunctionCallFailure,
  agentRetryMatchesSession,
  attemptProfile,
  buildStoryInjection,
  buildAgentRetryFeedback,
  agentRequestContext,
  type EraAgentFailedAttempt,
  type EraAgentRequestContext,
  builtinStagePrompts,
  countAgentCycles,
  executeAgentFunctionCalls,
  extractEraMessageKey,
  formatAgentPlanReport,
  isAgentPlanningFailureMessage,
  parsePlanningOutput,
  type EraAgentConfigurationV2,
  type EraAgentPlanningOutputV1,
} from "../../base_lib/agent_generation_session.ts";
import type {
  EraAgentFloorCandidateV1,
  EraFloorIdentityV1,
} from "@era/vibeflow-contracts";

import type {
  GenerationTrigger,
  GenerationRequest,
  AgentOutcome,
} from "../../base_lib/agent_flow_types.ts";
interface AgentCapability {
  await_native_completion(
    input: Readonly<Record<string, unknown>>,
  ): Promise<unknown>;
  generate(input: Readonly<Record<string, unknown>>): Promise<unknown>;
  generate_story(input: Readonly<Record<string, unknown>>): Promise<unknown>;
  inject_once(input: Readonly<Record<string, unknown>>): unknown;
  read_session_binding(input: Readonly<Record<string, unknown>>): unknown;
  write_session(input: Readonly<Record<string, unknown>>): unknown;
  clear_session(input: Readonly<Record<string, unknown>>): unknown;
  create_error_message(
    input: Readonly<Record<string, unknown>>,
  ): Promise<unknown>;
  stop_native_generation(input: Readonly<Record<string, unknown>>): unknown;
}

export function writeSession(
  capability: Pick<AgentCapability, "read_session_binding" | "write_session">,
  input: Readonly<Record<string, unknown>>,
): unknown {
  const facts = capability.read_session_binding({
    chatKey: input.chatKey,
  }) as SessionBindingFacts;
  return capability.write_session(prepareSessionWrite(input, facts));
}

class AgentSessionFailure extends Error {
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

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function throwHostGenerationFailure(result: unknown): void {
  if (!isRecord(result) || result.status !== "failed") return;
  const diagnostic = isRecord(result.diagnostic) ? result.diagnostic : {};
  const code =
    typeof diagnostic.code === "string" && diagnostic.code.length > 0
      ? diagnostic.code
      : "ERA_AGENT_AUXILIARY_REQUEST_FAILED";
  const message =
    typeof diagnostic.message === "string" && diagnostic.message.length > 0
      ? diagnostic.message
      : `${code}：辅助模型请求失败。`;
  throw new AgentSessionFailure(code, message);
}

function chatKey(context: Record<string, unknown>): string {
  const identity = isRecord(context.identity) ? context.identity : {};
  return typeof identity.chatId === "string" && identity.chatId.length > 0
    ? identity.chatId
    : "unknown-chat";
}

function stateContext(context: Record<string, unknown>): Readonly<{
  revision: number;
  statData: unknown;
  statFunc: Readonly<Record<string, unknown>>;
}> {
  const state = isRecord(context.state) ? context.state : {};
  return {
    revision: Number.isSafeInteger(state.revision) ? Number(state.revision) : 0,
    statData: Object.prototype.hasOwnProperty.call(state, "statData")
      ? structuredClone(state.statData)
      : {},
    statFunc: isRecord(state.statFunc) ? structuredClone(state.statFunc) : {},
  };
}

function latestMessage(
  context: Record<string, unknown>,
): Record<string, unknown> | null {
  return isRecord(context.latestMessage) ? context.latestMessage : null;
}

function lastUserText(context: Record<string, unknown>): string {
  const messages = Array.isArray(context.messages) ? context.messages : [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      isRecord(message) &&
      message.role === "user" &&
      typeof message.message === "string"
    )
      return message.message;
  }
  return "";
}

function sessionObject(
  context: Record<string, unknown>,
): Record<string, unknown> | null {
  return isRecord(context.session) ? structuredClone(context.session) : null;
}

function isAwaitingStorySession(
  context: Record<string, unknown>,
  session: Record<string, unknown> | null,
): session is Record<string, unknown> {
  return (
    session !== null &&
    session.chatKey === chatKey(context) &&
    (session.status === "opened" || session.status === "planned")
  );
}

/** 重进仅从最后一个持久化规划及实际正文恢复必要成果，不恢复历史请求。 */
function restoreMessageSession(
  context: Record<string, unknown>,
  configuration: EraAgentConfigurationV2,
): Record<string, unknown> | null {
  const latest = latestMessage(context);
  if (
    !latest ||
    latest.role !== "assistant" ||
    typeof latest.message !== "string"
  )
    return null;
  const extra =
    isRecord(latest.extra) && isRecord(latest.extra.era_agent)
      ? latest.extra.era_agent
      : null;
  if (!extra) return null;
  const text = latest.message;
  const block = [...text.matchAll(/<era_plan>([\s\S]*?)<\/era_plan>/giu)].at(
    -1,
  );
  let finalPlan: Record<string, unknown> = {};
  if (block) {
    const parsed: unknown = JSON.parse(block[1]);
    if (isRecord(parsed)) finalPlan = parsed;
  }
  const baseMessage = block ? text.slice(0, block.index) : "";
  const storyStart =
    typeof extra.storyStart === "number"
      ? extra.storyStart
      : block
        ? block.index! + block[0].length
        : 0;
  const storyEnd =
    typeof extra.storyEnd === "number" ? extra.storyEnd : text.length;
  const story = text.slice(storyStart, storyEnd);
  return {
    schemaVersion: 1,
    chatKey: chatKey(context),
    messageId: latest.message_id,
    configuration,
    status: extra.status ?? "story-complete",
    cycleIndex: extra.cycleIndex ?? 0,
    baseMessage,
    story,
    plan: finalPlan.plan ?? null,
    functionResults: finalPlan.functionResults ?? [],
    planReport: block
      ? formatAgentPlanReport({
          plan: finalPlan.plan,
          functionResults: finalPlan.functionResults,
        })
      : "",
    sourceKey: extractEraMessageKey(text) ?? "",
  };
}

function boundedTrace(value: string): string {
  return value.slice(0, 131072);
}

function openedSession(
  context: Record<string, unknown>,
  configuration: EraAgentConfigurationV2,
  kind: string,
  eventId: string,
): Record<string, unknown> {
  const latest = latestMessage(context);
  const continuing =
    kind === "continue" &&
    latest?.role === "assistant" &&
    typeof latest.message === "string";
  const baseMessage = continuing ? (latest.message as string) : "";
  return {
    schemaVersion: 2,
    chatKey: chatKey(context),
    status: "opened",
    execution: { id: eventId, trigger: kind === "normal" ? "initial" : kind },
    cycleIndex: continuing ? countAgentCycles(baseMessage) : 0,
    baseMessage,
    configuration,
    preState: stateContext(context),
  };
}

function stageRequest(
  profile: ReturnType<typeof attemptProfile>,
  stage: "planning" | "settlement",
  userInput: string,
  generationId: string,
  requestContext: EraAgentRequestContext,
): Record<string, unknown> {
  const preset = profile.preset;
  const orderedPrompts =
    preset.source === "builtin"
      ? builtinStagePrompts(stage)
      : preset.orderedPrompts;
  const settings = preset.source === "builtin" ? {} : (preset.settings ?? {});
  return {
    generationId,
    requestContext,
    stage,
    userInput,
    orderedPrompts,
    resolvePresetMacros: preset.source === "snapshot",
    requestPolicy: buildAgentRequestPolicy(profile.modelSource, settings),
  };
}

function sessionExecution(
  session: Record<string, unknown> | null,
  eventId: string,
) {
  const execution = session?.execution;
  return isRecord(execution) &&
    typeof execution.id === "string" &&
    typeof execution.trigger === "string"
    ? { id: execution.id, trigger: execution.trigger }
    : { id: eventId, trigger: "unrecorded" };
}

async function runPlanning(
  capability: AgentCapability,
  configuration: EraAgentConfigurationV2,
  context: Record<string, unknown>,
  trigger: GenerationTrigger,
): Promise<Record<string, unknown>> {
  const state = stateContext(context);
  const key = chatKey(context);
  const previousSession = sessionObject(context);
  const latest = latestMessage(context);
  const messageKey =
    latest && typeof latest.message === "string"
      ? extractEraMessageKey(latest.message)
      : null;
  const generationIdentity = isRecord(trigger.cycleIdentity)
    ? trigger.cycleIdentity
    : null;
  const sourceKey =
    (typeof generationIdentity?.sourceKey === "string"
      ? generationIdentity.sourceKey
      : null) ??
    messageKey ??
    `${key}:agent:${trigger.sequence}`;
  const drawOffset =
    previousSession?.sourceKey === sourceKey &&
    Number.isSafeInteger(previousSession.nextDrawOffset)
      ? Number(previousSession.nextDrawOffset)
      : 0;
  const retry =
    isRecord(context.candidateRetry) &&
    context.candidateRetry.stage === "planning"
      ? context.candidateRetry
      : null;
  const attempts: Record<string, unknown>[] = Array.isArray(retry?.attempts)
    ? [...retry.attempts]
    : [];
  let failure: EraAgentFailedAttempt | undefined = retry?.failure as
    EraAgentFailedAttempt | undefined;
  let correction: EraAgentFailedAttempt | undefined = failure;
  for (
    let attempt = Number(retry?.nextAttempt ?? 0);
    attempt <= configuration.planning.retryCount;
    attempt += 1
  ) {
    const profile = attemptProfile(configuration.planning, attempt);
    let response: string | undefined;
    let responseValidated = false;
    const requestContext = agentRequestContext(
      sessionExecution(previousSession, trigger.eventId),
      attempt,
      failure,
    );
    let requestId: string | undefined;
    let requestRoute: Record<string, unknown> | undefined;
    const userInput = [
      "请规划接下来的正式故事，并给出必要的纯函数调用表。",
      `用户输入：${lastUserText(context)}`,
      `当前变量：${JSON.stringify(state.statData)}`,
      `可用函数：${JSON.stringify(state.statFunc)}`,
      buildAgentRetryFeedback(correction),
    ]
      .filter(Boolean)
      .join("\n");
    try {
      const generated = await capability.generate(
        stageRequest(
          profile,
          "planning",
          userInput,
          `era-plan-${trigger.eventId}-${attempt}`,
          requestContext,
        ),
      );
      requestId =
        isRecord(generated) && typeof generated.requestId === "string"
          ? generated.requestId
          : undefined;
      requestRoute =
        isRecord(generated) && isRecord(generated.route)
          ? generated.route
          : undefined;
      throwHostGenerationFailure(generated);
      response =
        isRecord(generated) && typeof generated.response === "string"
          ? generated.response
          : "";
      let plan: EraAgentPlanningOutputV1;
      let candidateValidationError: string | null = null;
      try {
        plan = parsePlanningOutput(response);
      } catch (error) {
        const parts = splitAgentStageText(response);
        plan = {
          storyPlan: {},
          calls: [],
          instructionsBefore: parts.before,
          instructionsAfter: parts.after,
        };
        candidateValidationError = failureMessage(error);
      }
      // The calls execute between the surrounding blocks, against their
      // accumulated state. Generation only supplies the ordered candidate.
      const executed: ReturnType<typeof executeAgentFunctionCalls> = {
        results: [],
        nextDrawOffset: drawOffset,
      };
      responseValidated = true;
      attempts.push({
        attempt,
        requestContext,
        status: "passed",
        response: boundedTrace(response),
        ...(requestId ? { requestId } : {}),
        ...(requestRoute ? { route: requestRoute } : {}),
        functionResults: executed.results.map((result) => ({
          ...result,
          status: "passed",
          ...(plan.calls[result.index]?.purpose !== undefined
            ? { purpose: plan.calls[result.index].purpose }
            : {}),
        })),
        preset: profile.preset.source,
        ...(profile.preset.source === "snapshot" && profile.preset.sourceName
          ? { presetName: profile.preset.sourceName }
          : {}),
        modelSource: profile.modelSource,
      });
      return {
        ...(previousSession ?? {}),
        schemaVersion: 1,
        chatKey: key,
        status: "planned",
        cycleIndex: Number(previousSession?.cycleIndex ?? 0),
        sourceKey,
        configuration,
        preState: state,
        plan,
        planningDraft: [plan.instructionsBefore, plan.instructionsAfter]
          .filter(Boolean)
          .join("\n"),
        functionResults: executed.results,
        nextDrawOffset: executed.nextDrawOffset,
        planningAttempts: attempts,
        candidateStartSession: previousSession,
        candidateSourceResponse: response,
        candidateValidationError,
        planReport: formatAgentPlanReport({
          plan,
          functionResults: executed.results,
        }),
      };
    } catch (error) {
      if (responseValidated) throw error;
      failure = { response, diagnostic: failureMessage(error), requestId };
      // A failed request must preserve the last rejected model candidate.
      if (response !== undefined) correction = failure;
      attempts.push({
        attempt,
        requestContext,
        status: "failed",
        response: boundedTrace(response ?? ""),
        diagnostic: failure.diagnostic,
        ...(requestId ? { requestId } : {}),
        ...(requestRoute ? { route: requestRoute } : {}),
        ...(error instanceof AgentFunctionCallFailure
          ? { functionResults: error.functionResults }
          : {}),
        preset: profile.preset.source,
        ...(profile.preset.source === "snapshot" && profile.preset.sourceName
          ? { presetName: profile.preset.sourceName }
          : {}),
        modelSource: profile.modelSource,
      });
    }
  }
  capability.stop_native_generation({ reason: "planning-exhausted" });
  const report =
    '<era_agent_error>{"stage":"planning","status":"failed"}</era_agent_error>';
  await capability.create_error_message({ message: report });
  capability.clear_session({ chatKey: key });
  throw new AgentSessionFailure(
    "ERA_AGENT_PLANNING_EXHAUSTED",
    `规划阶段在 ${configuration.planning.retryCount + 1} 次尝试后仍失败。`,
  );
}

async function runSettlement(
  capability: AgentCapability,
  configuration: EraAgentConfigurationV2,
  context: Record<string, unknown>,
  session: Record<string, unknown> | null,
  identity: EraFloorIdentityV1,
  requiresInitialPresentation: boolean,
  observationEventId: string,
): Promise<EraAgentFloorCandidateV1> {
  const latest = latestMessage(context);
  if (
    !latest ||
    latest.role !== "assistant" ||
    typeof latest.message !== "string"
  ) {
    throw new TypeError("变量结算阶段找不到当前 assistant 故事消息。");
  }
  const state = stateContext(context);
  const statData = Object.prototype.hasOwnProperty.call(state, "statData")
    ? state.statData
    : {};
  const statFunc = isRecord(state.statFunc) ? state.statFunc : {};
  const baseMessage =
    typeof session?.baseMessage === "string" ? session.baseMessage : "";
  const cycleSource =
    typeof session?.story === "string"
      ? session.story
      : baseMessage.length > 0 && latest.message.startsWith(baseMessage)
        ? latest.message.slice(baseMessage.length)
        : latest.message;
  const isolated = { story: cycleSource, audit: "" };
  const retry =
    isRecord(context.candidateRetry) &&
    context.candidateRetry.stage === "settlement"
      ? context.candidateRetry
      : null;
  const attempts: Record<string, unknown>[] = Array.isArray(retry?.attempts)
    ? [...retry.attempts]
    : [];
  let failure: EraAgentFailedAttempt | undefined = retry?.failure as
    EraAgentFailedAttempt | undefined;
  let correction: EraAgentFailedAttempt | undefined = failure;
  for (
    let attempt = Number(retry?.nextAttempt ?? 0);
    attempt <= configuration.settlement.retryCount;
    attempt += 1
  ) {
    const profile = attemptProfile(configuration.settlement, attempt);
    let response: string | undefined;
    let responseValidated = false;
    const requestContext = agentRequestContext(
      sessionExecution(session, observationEventId),
      attempt,
      failure,
    );
    let requestId: string | undefined;
    let requestRoute: Record<string, unknown> | undefined;
    const userInput = [
      "请根据正式故事结算变量，基于已执行正文操作后的当前状态，仅结算尚需变更的部分。",
      `故事：${isolated.story}`,
      `当前变量：${JSON.stringify(statData)}`,
      `当前函数：${JSON.stringify(statFunc)}`,
      session?.plan ? `故事计划：${JSON.stringify(session.plan)}` : "",
      session?.functionResults
        ? `函数结果：${JSON.stringify(session.functionResults)}`
        : "",
      isolated.audit ? `故事模型标签审计：${isolated.audit}` : "",
      buildAgentRetryFeedback(correction),
    ]
      .filter(Boolean)
      .join("\n");
    try {
      const generated = await capability.generate(
        stageRequest(
          profile,
          "settlement",
          userInput,
          `era-settle-${String(latest.message_id)}-${attempt}`,
          requestContext,
        ),
      );
      requestId =
        isRecord(generated) && typeof generated.requestId === "string"
          ? generated.requestId
          : undefined;
      throwHostGenerationFailure(generated);
      response =
        isRecord(generated) && typeof generated.response === "string"
          ? generated.response
          : "";
      requestRoute =
        isRecord(generated) && isRecord(generated.route)
          ? generated.route
          : undefined;
      const settlement = inspectSettlementText(response);
      const operations = parseMessageBlocks({ content: response }).map(
        (block) =>
          block.kind === "command"
            ? block.command
            : { call: block.call.name, args: block.call.args },
      );
      responseValidated = true;
      attempts.push({
        attempt,
        requestContext,
        status: "passed",
        response: boundedTrace(response),
        operations,
        ...(requestRoute ? { route: requestRoute } : {}),
        preset: profile.preset.source,
        ...(profile.preset.source === "snapshot" && profile.preset.sourceName
          ? { presetName: profile.preset.sourceName }
          : {}),
        modelSource: profile.modelSource,
        ...(requestId ? { requestId } : {}),
      });
      const planReport =
        typeof session?.planReport === "string" ? session.planReport : "";
      const stageMemory = isRecord(session?.stageMemory)
        ? session.stageMemory
        : null;
      const completedStory =
        typeof stageMemory?.content === "string"
          ? stageMemory.content
          : [baseMessage, session?.planningDraft, planReport, isolated.story]
              .filter(Boolean)
              .join("\n");
      const message = [completedStory, settlement.content]
        .filter(Boolean)
        .join("\n");
      const storyPrefix = [baseMessage, session?.planningDraft, planReport]
        .filter(Boolean)
        .join("\n");
      const storyStart = storyPrefix.length + (storyPrefix.length > 0 ? 1 : 0);
      writeSession(capability, {
        chatKey: chatKey(context),
        observationEventId,
        session: {
          ...(session ?? {}),
          schemaVersion: 1,
          status: "settled",
          messageId: Number(latest.message_id),
          baseMessage,
          story: isolated.story,
          settlementAttempts: attempts,
          transaction: settlement.content,
        },
      });
      const candidate: EraAgentFloorCandidateV1 = {
        messageId: identity.messageId,
        swipeId: identity.swipeId,
        mk: identity.mk,
        content: message,
        extra: {
          era_agent: {
            schemaVersion: 1,
            status: "settled",
            cycleIndex: Number(session?.cycleIndex ?? 0),
            storyStart,
            storyEnd: storyStart + isolated.story.length,
          },
        },
        terminalStatus: "settled",
        requiresInitialPresentation,
      };
      throw new AgentStageBoundary(
        {
          ...(session ?? {}),
          status: "settled",
          messageId: identity.messageId,
          baseMessage,
          story: isolated.story,
          settlementAttempts: attempts,
          transaction: settlement.content,
          candidateStartSession: session,
          candidateSourceResponse: response,
          candidateValidationError: settlement.error,
          candidatePrefix: [completedStory, settlement.prefix]
            .filter(Boolean)
            .join("\n"),
        },
        "settlement",
        { content: settlement.content },
        "commit",
        candidate,
      );
    } catch (error) {
      // Session/persistence failures after validation are not model mistakes.
      if (responseValidated) throw error;
      failure = { response, diagnostic: failureMessage(error), requestId };
      if (response !== undefined) correction = failure;
      attempts.push({
        attempt,
        requestContext,
        status: "failed",
        response: boundedTrace(response ?? ""),
        diagnostic: failure.diagnostic,
        preset: profile.preset.source,
        ...(profile.preset.source === "snapshot" && profile.preset.sourceName
          ? { presetName: profile.preset.sourceName }
          : {}),
        modelSource: profile.modelSource,
        ...(requestRoute ? { route: requestRoute } : {}),
        ...(requestId ? { requestId } : {}),
      });
    }
  }
  const planReport =
    typeof session?.planReport === "string" ? session.planReport : "";
  const message = [
    baseMessage,
    session?.planningDraft,
    planReport,
    isolated.story,
  ]
    .filter(Boolean)
    .join("\n");
  writeSession(capability, {
    chatKey: chatKey(context),
    observationEventId,
    session: {
      ...(session ?? {}),
      schemaVersion: 1,
      status: "unsettled",
      messageId: Number(latest.message_id),
      baseMessage,
      story: isolated.story,
      settlementAttempts: attempts,
    },
  });
  return {
    messageId: identity.messageId,
    swipeId: identity.swipeId,
    mk: identity.mk,
    content: message,
    extra: {
      era_agent: {
        schemaVersion: 1,
        status: "unsettled",
        cycleIndex: Number(session?.cycleIndex ?? 0),
      },
    },
    terminalStatus: "unsettled",
    requiresInitialPresentation,
  };
}

async function retryStory(
  capability: AgentCapability,
  _configuration: EraAgentConfigurationV2,
  context: Record<string, unknown>,
  session: Record<string, unknown>,
  identity: EraFloorIdentityV1,
  observationEventId: string,
): Promise<EraAgentFloorCandidateV1> {
  const latest = latestMessage(context);
  if (
    !latest ||
    latest.role !== "assistant" ||
    !Number.isSafeInteger(latest.message_id)
  ) {
    throw new TypeError("仅允许重试最新 assistant 消息的最新 Agent 周期。");
  }
  const plan =
    isRecord(session.plan) && Array.isArray(session.plan.calls)
      ? (session.plan as unknown as EraAgentPlanningOutputV1)
      : null;
  const injection =
    plan === null
      ? ""
      : buildStoryInjection({
          plan,
          results: Array.isArray(session.functionResults)
            ? (session.functionResults as Record<string, never>[])
            : [],
        });
  const generated = await capability.generate_story({
    userInput: lastUserText(context),
    injection,
    requestContext: agentRequestContext(
      sessionExecution(session, observationEventId),
      0,
    ),
  });
  const story =
    isRecord(generated) && typeof generated.response === "string"
      ? generated.response.trim()
      : "";
  if (story.length === 0) throw new TypeError("故事重试返回了空正文。");
  const nextSession = {
    ...session,
    story,
    ...(isRecord(generated) && typeof generated.requestId === "string"
      ? { storyRequestId: generated.requestId }
      : {}),
  };
  throw new AgentStageBoundary(
    { ...nextSession, messageId: identity.messageId, status: "story-complete" },
    "story",
    { story },
    "settlement",
  );
}
function outcome(
  mode: AgentOutcome["mode"],
  status: AgentOutcome["status"] = "no-op",
  diagnostics: AgentOutcome["diagnostics"] = [],
  value?: unknown,
  candidate?: EraAgentFloorCandidateV1,
): AgentOutcome {
  return {
    mode,
    status,
    diagnostics,
    ...(value === undefined ? {} : { value }),
    ...(candidate ? { candidate } : {}),
  };
}
function requestIdentity(request: GenerationRequest): EraFloorIdentityV1 {
  if (request.identityError)
    throw new AgentSessionFailure(
      request.identityError.code,
      request.identityError.message,
    );
  if (!request.identity)
    throw new AgentSessionFailure(
      "ERA_AGENT_FLOOR_IDENTITY_REQUIRED",
      "Agent 楼层候选缺少真实 assistant 楼层身份。",
    );
  return request.identity;
}
export async function run(
  inputs: Readonly<Record<string, unknown>>,
  _params: Readonly<Record<string, unknown>>,
  runtime: { capabilities: { "era.tavern.agent": AgentCapability } },
): Promise<any> {
  const request = (
    inputs["era.agent.generation.request"] as { value: GenerationRequest }
  ).value;
  let stageSession: Record<string, unknown> | null = null;
  const output = (generation_outcome: AgentOutcome) => ({
    generation_outcome: {
      ...generation_outcome,
      ...(inputs["era.step.request.routed"]
        ? {
            stageWorkInput: {
              step: (inputs["era.step.request.routed"] as { value: unknown })
                .value,
              executionState: (
                inputs["era.batch.execution.state"] as { value: unknown }
              ).value,
              request,
              session: stageSession ?? request.context?.session ?? null,
            },
          }
        : {}),
    },
  });
  const capability = runtime.capabilities["era.tavern.agent"];
  if (request.phase === "finish") return output(request.disposition!);
  const rawContext = request.context!;
  if (request.phase === "cancel") {
    capability.clear_session({ chatKey: chatKey(rawContext) });
    return output(
      outcome("legacy-ignore", "committed", [], {
        status: "generation-cancelled",
      }),
    );
  }
  const configuration = request.configuration,
    trigger = request.trigger,
    type = trigger.type;
  try {
    const candidateRetry = isRecord(rawContext.candidateRetry)
      ? rawContext.candidateRetry
      : null;
    if (candidateRetry?.stage === "planning") {
      const planned = await runPlanning(
        capability,
        configuration,
        rawContext,
        trigger,
      );
      throw new AgentStageBoundary(
        planned,
        "planning",
        {},
        candidateRetry.next as any,
      );
    }
    if (candidateRetry?.stage === "settlement") {
      const candidate = await runSettlement(
        capability,
        configuration,
        rawContext,
        sessionObject(rawContext),
        request.identity!,
        Boolean(candidateRetry.requiresInitialPresentation),
        trigger.eventId,
      );
      return output(
        outcome("execute-legacy", "committed", [], undefined, candidate),
      );
    }
    if (type === "era.agent.stage_continue") {
      const session = sessionObject(rawContext);
      const pending =
        session && isRecord(session.pendingStage) ? session.pendingStage : null;
      if (
        !session ||
        !pending ||
        !isRecord(trigger.retry) ||
        pending.completionId !== trigger.retry.completionId
      )
        return output(outcome("execute-only", "no-op"));
      if (trigger.retry.cancelled === true) {
        if (pending.next === "native-story")
          capability.stop_native_generation({});
        capability.clear_session({ chatKey: chatKey(rawContext) });
        return output(
          outcome("execute-only", "no-op", [], {
            status: "generation-cancelled",
          }),
        );
      }
      const expected = isRecord(pending.identity) ? pending.identity : null;
      if (
        expected &&
        (!request.identity ||
          (typeof expected.mk === "string" &&
            expected.mk !== request.identity.mk) ||
          expected.messageId !== request.identity.messageId ||
          expected.swipeId !== request.identity.swipeId)
      )
        return output(outcome("execute-only", "no-op"));
      const resumed: Record<string, unknown> = {
        ...session,
        pendingStage: null,
        preState: stateContext(rawContext),
      };
      if (pending.next !== "commit" && expected) {
        const oldTx = [
          ...String(pending.originalMessage ?? "").matchAll(
            /<era_tx\b[^>]*>[\s\S]*?<\/era_tx>/giu,
          ),
        ].map((match) => match[0]);
        const added = [
          ...String(latestMessage(rawContext)?.message ?? "").matchAll(
            /<era_tx\b[^>]*>[\s\S]*?<\/era_tx>/giu,
          ),
        ]
          .map((match) => match[0])
          .filter((tx) => {
            const index = oldTx.indexOf(tx);
            if (index < 0) return true;
            oldTx.splice(index, 1);
            return false;
          });
        if (added.length)
          resumed.baseMessage = [resumed.baseMessage, ...added]
            .filter(Boolean)
            .join("\n");
      }
      writeSession(capability, {
        chatKey: chatKey(rawContext),
        session: resumed,
      });
      if (pending.next === "native-story") {
        capability.inject_once({
          id: `era-agent-story-${trigger.eventId}`,
          content: buildStoryInjection({
            plan: resumed.plan as unknown as EraAgentPlanningOutputV1,
            results: Array.isArray(resumed.functionResults)
              ? (resumed.functionResults as Record<string, never>[])
              : [],
          }),
        });
        // The planning floor is still an in-memory future message. Native
        // generation must create it before the ordinary save path can write it.
        return output(outcome("legacy-ignore", "committed"));
      }
      const identity = requestIdentity(request);
      if (pending.next === "manual-story")
        return output(
          outcome(
            "execute-legacy",
            "committed",
            [],
            undefined,
            await retryStory(
              capability,
              configuration,
              rawContext,
              resumed,
              identity,
              trigger.eventId,
            ),
          ),
        );
      if (pending.next === "settlement" && configuration.settlement.enabled)
        return output(
          outcome(
            "execute-legacy",
            "committed",
            [],
            undefined,
            await runSettlement(
              capability,
              configuration,
              rawContext,
              resumed,
              identity,
              resumed.initialPresentation === true,
              trigger.eventId,
            ),
          ),
        );
      const story = typeof resumed.story === "string" ? resumed.story : "";
      const candidate = isRecord(pending.candidate)
        ? ({
            ...pending.candidate,
            ...(expected && typeof expected.mk !== "string"
              ? { mk: identity.mk }
              : {}),
          } as unknown as EraAgentFloorCandidateV1)
        : {
            messageId: identity.messageId,
            swipeId: identity.swipeId,
            mk: identity.mk,
            content:
              isRecord(resumed.stageMemory) &&
              typeof resumed.stageMemory.content === "string"
                ? resumed.stageMemory.content
                : [
                    resumed.baseMessage,
                    resumed.planningDraft,
                    resumed.planReport,
                    story,
                  ]
                    .filter(Boolean)
                    .join("\n"),
            extra: {
              era_agent: { schemaVersion: 1, status: "story-complete" },
            },
            terminalStatus: "story-complete" as const,
            requiresInitialPresentation: resumed.initialPresentation === true,
          };
      const current = String(latestMessage(rawContext)?.message ?? "");
      const previousTransactions = [
        ...String(pending.originalMessage ?? "").matchAll(
          /<era_tx\b[^>]*>[\s\S]*?<\/era_tx>/giu,
        ),
      ].map((match) => match[0]);
      const remaining = [...previousTransactions];
      const appended = [
        ...current.matchAll(/<era_tx\b[^>]*>[\s\S]*?<\/era_tx>/giu),
      ]
        .map((match) => match[0])
        .filter((tx) => {
          const index = remaining.indexOf(tx);
          if (index < 0) return true;
          remaining.splice(index, 1);
          return false;
        })
        .join("\n");
      const transaction =
        typeof resumed.transaction === "string" ? resumed.transaction : "";
      const content = appended
        ? transaction && candidate.content.endsWith(transaction)
          ? candidate.content.slice(0, -transaction.length) +
            appended +
            "\n" +
            transaction
          : candidate.content + "\n" + appended
        : candidate.content;
      writeSession(capability, {
        chatKey: chatKey(rawContext),
        observationEventId: trigger.eventId,
        session: {
          ...resumed,
          pendingStage: null,
          status: candidate.terminalStatus,
        },
      });
      return output(
        outcome("execute-legacy", "committed", [], undefined, {
          ...candidate,
          content,
        }),
      );
    }
    if (type === "message_sent" || type === "generation_started") {
      const kind = type === "generation_started" ? trigger.kind : "normal";
      let session = sessionObject(rawContext);
      if (
        type === "generation_started" &&
        kind === "normal" &&
        !isAwaitingStorySession(rawContext, session)
      ) {
        return output(outcome("legacy"));
      }
      const startsNewCycle = type === "message_sent" || kind !== "normal";
      if (startsNewCycle) {
        session = openedSession(
          rawContext,
          configuration,
          kind,
          trigger.eventId,
        );
        writeSession(capability, {
          chatKey: chatKey(rawContext),
          session,
          nativeGeneration: true,
        });
      }
      if (session === null) {
        throw new TypeError("Agent 生成周期未能建立会话。");
      }
      const shouldPlanNow =
        type === "message_sent" ||
        (type === "generation_started" && kind !== "normal");
      if (
        configuration.planning.enabled &&
        shouldPlanNow &&
        session.status !== "planned"
      ) {
        const planningContext = { ...rawContext, session };
        session = await runPlanning(
          capability,
          configuration,
          planningContext,
          trigger,
        );
        throw new AgentStageBoundary(
          session,
          "planning",
          { plan: session.plan, functionResults: session.functionResults },
          "native-story",
        );
      }
      return output(
        outcome(
          session.status === "planned" && isRecord(session.stageMemory)
            ? "legacy-ignore"
            : "execute-legacy",
          "committed",
        ),
      );
    }

    if (type === "message_received") {
      if (isAgentPlanningFailureMessage(latestMessage(rawContext))) {
        capability.clear_session({ chatKey: chatKey(rawContext) });
        return output(
          outcome("legacy-ignore", "committed", [], {
            status: "planning-failed-message-preserved",
          }),
        );
      }
      const session = sessionObject(rawContext);
      if (!isAwaitingStorySession(rawContext, session)) {
        return output(outcome("legacy"));
      }
      let candidate: EraAgentFloorCandidateV1 | undefined;
      const identity = requestIdentity(request);
      if (configuration.settlement.enabled || configuration.planning.enabled) {
        const execution = sessionExecution(session, trigger.eventId);
        const completed = await capability.await_native_completion({
          chatId: chatKey(rawContext),
          executionId: execution.id,
        });
        const current =
          isRecord(completed) && isRecord(completed.latestMessage)
            ? completed.latestMessage
            : null;
        if (
          !isRecord(completed) ||
          (completed.status !== "completed" &&
            completed.status !== "not-native") ||
          completed.executionId !== execution.id ||
          !isRecord(completed.identity) ||
          completed.identity.chatId !== identity.chatId ||
          !current ||
          current.message_id !== identity.messageId ||
          Number(current.swipe_id ?? 0) !== identity.swipeId ||
          current.message !== latestMessage(rawContext)?.message
        ) {
          return output(
            outcome("legacy-ignore", "no-op", [], {
              status: "native-generation-no-longer-current",
            }),
          );
        }
      }
      if (configuration.settlement.enabled) {
        const latest = latestMessage(rawContext)!;
        const baseMessage =
          typeof session?.baseMessage === "string" ? session.baseMessage : "";
        const content = String(latest.message ?? "");
        const story =
          baseMessage && content.startsWith(baseMessage)
            ? content.slice(baseMessage.length)
            : content;
        throw new AgentStageBoundary(
          {
            ...(session ?? {}),
            story,
            messageId: identity.messageId,
            initialPresentation: true,
          },
          "story",
          { story },
          "settlement",
        );
      } else if (configuration.planning.enabled) {
        const latest = latestMessage(rawContext);
        if (
          latest &&
          typeof latest.message === "string" &&
          Number.isSafeInteger(latest.message_id)
        ) {
          const baseMessage =
            typeof session?.baseMessage === "string" ? session.baseMessage : "";
          const cycleSource =
            baseMessage.length > 0 && latest.message.startsWith(baseMessage)
              ? latest.message.slice(baseMessage.length)
              : latest.message;
          const story = cycleSource;
          const message = [
            baseMessage,
            session?.planningDraft,
            typeof session?.planReport === "string" ? session.planReport : "",
            story,
          ]
            .filter(Boolean)
            .join("\n");
          candidate = {
            messageId: identity.messageId,
            swipeId: identity.swipeId,
            mk: identity.mk,
            content: message,
            extra: {
              era_agent: {
                schemaVersion: 1,
                status: "story-complete",
                cycleIndex: Number(session?.cycleIndex ?? 0),
              },
            },
            terminalStatus: "story-complete",
            requiresInitialPresentation: true,
          };
          writeSession(capability, {
            chatKey: chatKey(rawContext),
            session: {
              ...(session ?? {}),
              status: "story-complete",
              messageId: Number(latest.message_id),
              baseMessage,
              story,
            },
          });
          throw new AgentStageBoundary(
            {
              ...(session ?? {}),
              story,
              messageId: identity.messageId,
              initialPresentation: true,
            },
            "story",
            { story },
            "commit",
            candidate,
          );
        }
      }
      return output(
        outcome("execute-legacy", "committed", [], undefined, candidate),
      );
    }

    if (type === "era.ui.agent_retry") {
      const retry = trigger.retry;
      if (
        !isRecord(retry) ||
        !["planning", "story", "settlement"].includes(String(retry.kind))
      ) {
        throw new TypeError("重试 kind 只允许 planning、story 或 settlement。");
      }
      let session =
        sessionObject(rawContext) ??
        restoreMessageSession(rawContext, configuration);
      if (session === null)
        throw new TypeError("当前聊天没有可重试的最新 Agent 周期。");
      if (!agentRetryMatchesSession(retry, session))
        throw new TypeError(
          "当前报告对应的 Agent 周期已失效，请查看最新楼层。",
        );
      const identity = requestIdentity(request);
      let candidate: EraAgentFloorCandidateV1;
      session = {
        ...session,
        execution: {
          id: trigger.eventId,
          trigger: `manual-${String(retry.kind)}`,
        },
      };
      if (retry.kind === "planning") {
        session = await runPlanning(
          capability,
          configuration,
          { ...rawContext, session },
          trigger,
        );
        throw new AgentStageBoundary(
          session,
          "planning",
          { plan: session.plan, functionResults: session.functionResults },
          "manual-story",
        );
      } else if (retry.kind === "story") {
        candidate = await retryStory(
          capability,
          configuration,
          rawContext,
          session,
          identity,
          trigger.eventId,
        );
      } else {
        // A manual settlement replaces the previous settlement suffix. The
        // completed stage draft includes that suffix; rebuild from the retained
        // planning/body content, including their applied API records and done.
        session = { ...session, stageMemory: null };
        candidate = await runSettlement(
          capability,
          configuration,
          rawContext,
          session,
          identity,
          false,
          trigger.eventId,
        );
      }
      return output(
        outcome("execute-legacy", "committed", [], undefined, candidate),
      );
    }
  } catch (error) {
    if (error instanceof AgentStageBoundary) {
      const boundary = {
        stage: error.stage,
        session: { execution: error.session.execution },
        result: error.result,
        chatKey: chatKey(rawContext),
        eventId: trigger.eventId,
        identity:
          error.stage === "planning" && type !== "era.ui.agent_retry"
            ? null
            : request.identity
              ? {
                  messageId: request.identity.messageId,
                  swipeId: request.identity.swipeId,
                  ...(extractEraMessageKey(
                    String(latestMessage(rawContext)?.message ?? ""),
                  )
                    ? {
                        mk: extractEraMessageKey(
                          String(latestMessage(rawContext)?.message ?? ""),
                        )!,
                      }
                    : {}),
                }
              : null,
      };
      const handoff = stageHandoff(boundary);
      try {
        stageSession = {
          ...error.session,
          pendingStage: {
            completionId: handoff.completionId,
            next: error.next,
            identity: boundary.identity,
            originalMessage: latestMessage(rawContext)?.message ?? "",
            candidate: error.candidate ?? null,
          },
        };
        writeSession(capability, {
          chatKey: chatKey(rawContext),
          session: stageSession,
        });
        return output({
          mode: "execute-only",
          status: "committed",
          diagnostics: [],
          stageBoundary: boundary,
        });
      } catch (failure) {
        return output(
          outcome("execute-only", "failed", [
            {
              code: "ERA_AGENT_SESSION_FAILED",
              message: failureMessage(failure),
            },
          ]),
        );
      }
    }
    const code =
      error instanceof AgentSessionFailure
        ? error.code
        : "ERA_AGENT_SESSION_FAILED";
    return output(
      outcome("execute-only", "failed", [
        { code, message: failureMessage(error) },
      ]),
    );
  }
  return output(outcome("legacy"));
}
