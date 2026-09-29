/** Agent settlement and story retry stages. */
import { parseMessageBlocks } from "../domain/commands/message_function_calls.ts";
import { inspectSettlementText } from "./agent_stage_text.ts";
import { AgentStageBoundary } from "./agent_stage_handoff.ts";
import { buildAgentRetryFeedback, agentRequestContext, type EraAgentFailedAttempt, attemptProfile, type EraAgentConfigurationV2, type EraAgentPlanningOutputV1 } from "./agent_configuration.ts";
import { buildStoryInjection } from "./agent_report_text.ts";
import { writeSession, isRecord, failureMessage, throwHostGenerationFailure, chatKey, stateContext, latestMessage, lastUserText, boundedTrace, stageRequest, sessionExecution, type AgentCapability } from "./agent_generation_context.ts";
import type { EraAgentFloorCandidateV1, EraFloorIdentityV1 } from "@era/vibeflow-contracts";

export async function runSettlement(
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

export async function retryStory(
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
