import type {
EraAgentFloorCandidateV1
} from "@era/vibeflow-contracts";
import { AgentSessionFailure,chatKey,failureMessage,isAwaitingStorySession,isRecord,latestMessage,openedSession,outcome,requestIdentity,restoreMessageSession,sessionExecution,sessionObject,writeSession,type AgentCapability } from "../../base_lib/agent/agent_generation_context.ts";
import { continueAgentStage } from "../../base_lib/agent/agent_generation_continue.ts";
import { runPlanning } from "../../base_lib/agent/agent_generation_planning.ts";
import {
agentRetryMatchesSession,
extractEraMessageKey,
isAgentPlanningFailureMessage
} from "../../base_lib/agent/agent_generation_session.ts";
import { retryStory,runSettlement } from "../../base_lib/agent/agent_generation_settlement.ts";
import {
AgentStageBoundary,
stageHandoff,
} from "../../base_lib/agent/agent_stage_handoff.ts";
export { writeSession } from "../../base_lib/agent/agent_generation_context.ts";

import type {
AgentOutcome,
GenerationRequest
} from "../../base_lib/agent/agent_flow_types.ts";
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
    if (type === "era.agent.stage_continue")
      return await continueAgentStage(capability, configuration, rawContext, trigger, request, output);
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
