import { parseMessageBlocks } from "../../base_lib/domain/message_function_calls.ts";
import {
  planSyncWork,
  stableBase36Token,
} from "../../base_lib/sync_planning.ts";
import {
  consecutiveFacts,
  syncFailure,
} from "../../base_lib/sync_contracts.ts";
import { variablesForState } from "../../base_lib/sidecar_binding.ts";
import {
  formatMessageKeyBlock,
  generateMessageKey,
  stripEraDataBlocks,
} from "../../base_lib/domain/mk_engine.ts";

/** Give every executable stage an ordinary message range, with an in-memory future floor for planning. */
export function run(inputs: any, _params: any, runtime: any): any {
  const outcome = inputs["era.agent.generation.raw"].value;
  const input = outcome.stageWorkInput;
  const base = {
    work: {
      schemaVersion: 1,
      step: input.step,
      disposition: "no-op",
      plan: null,
      payload: null,
      failure: null,
    },
    done: true,
    sourceBasis: null,
    stageOutcome: outcome,
  };
  if (!outcome.stageBoundary) return { block_step_state: base };
  const session = input.session ?? {};
  const stage = outcome.stageBoundary.stage;
  const working = runtime.capabilities["era.tavern.sidecar"].read_working(
    {},
  ).working;
  if (!working)
    return {
      block_step_state: {
        ...base,
        work: {
          ...base.work,
          disposition: "failed",
          failure: syncFailure(
            "ERA_WORKING_STATE_MISSING",
            "阶段变量尚未就绪。",
            "domain",
          ),
        },
      },
    };
  const original = input.step.dispatchContext;
  const sourceBasis = original.sourceBasis;
  const messages = [...original.messages];
  const prior = session.stageMemory;
  const kind = input.request.trigger.kind;
  // Regeneration may already have removed the old assistant floor. Reuse a
  // floor only when the captured request actually owns one; otherwise planning
  // uses the same future-floor allocation as a new response.
  const replace = Boolean(
    input.request.identity &&
    (kind === "continue" ||
      kind === "swipe" ||
      kind === "regenerate" ||
      input.request.trigger.type === "era.ui.agent_retry"),
  );
  const messageId =
    stage === "planning"
      ? replace
        ? input.request.identity.messageId
        : (messages.at(-1)?.messageId ?? -1) + 1
      : input.request.identity.messageId;
  const actual = sourceBasis.messages.find(
    (message: any) => message.messageId === messageId,
  );
  const mk =
    prior?.messageId === messageId
      ? prior.mk
      : stage !== "planning" || replace
        ? input.request.identity.mk
        : generateMessageKey({
            timestamp: Math.max(
              0,
              Math.trunc(input.step.task.primaryEvent.occurredAt),
            ),
            token: stableBase36Token(
              `${input.request.trigger.eventId}:draft:${messageId}`,
            ),
          });
  const floor = {
    chatId: sourceBasis.identity.chatId,
    messageId,
    swipeId: actual?.swipeIndex ?? 0,
    mk,
  };
  const prefix = [
    session.baseMessage,
    session.planningDraft,
    session.planReport,
  ]
    .filter(Boolean)
    .join("\n");
  const candidate = session.pendingStage?.candidate;
  const content =
    stage === "planning"
      ? [session.baseMessage, session.planningDraft].filter(Boolean).join("\n")
      : stage === "story"
        ? [prefix, session.story].filter(Boolean).join("\n")
        : String(candidate?.content ?? "");
  const text = `${stripEraDataBlocks(content)}\n${formatMessageKeyBlock(mk, "assistant")}`;
  const message = {
    schemaVersion: 1,
    messageId,
    role: "assistant",
    activeText: text,
    swipeIndex: actual?.swipeIndex ?? 0,
  };
  const at = messages.findIndex((item: any) => item.messageId === messageId);
  if (at < 0) messages.push(message);
  else messages[at] = message;
  const step = {
    ...input.step,
    taskRoute: "sync",
    task: {
      ...input.step.task,
      kind: "sync",
      context: "latest-message-with-mk",
      reason: "manual",
      target: { kind: "message", messageId, stopAfterTarget: true },
      fullRebuild: false,
    },
    dispatchContext: {
      ...original,
      schemaVersion: 3,
      status: "ready",
      dispatchClass: "sync",
      requirement: "latest-message-with-mk",
      messages,
      sourceBasis,
      processingMessage: message,
      processingMk: mk,
      floorIdentity: floor,
      agentFloorCandidate: null,
      stagedMessageUpdates: [
        ...original.stagedMessageUpdates.filter(
          (update: any) => update.messageId !== messageId,
        ),
        { messageId, content: text },
      ],
    },
  };
  const work = planSyncWork(
    {
      step,
      status: "ready",
      messagesRaw: { messages },
      failure: null,
      variablesRaw: variablesForState(
        working.record.state,
        working.record.sidecarId,
      ),
      consecutive: consecutiveFacts(input.executionState),
    },
    true,
  );
  return {
    block_step_state: {
      ...base,
      work,
      done: work.disposition !== "commit",
      sourceBasis,
      scopeWindow: input.executionState.nextState.scopeWindow,
      stageOutcome: {
        ...outcome,
        stageWorkInput: {
          ...input,
          stageFloor: floor,
          recovery: {
            working,
            session:
              session.candidateStartSession ??
              input.request.context.session ??
              null,
          },
          ...((stage === "planning" && session.plan) ||
          session.candidateValidationError
            ? {
                program: {
                  remaining: parseMessageBlocks({
                    content:
                      stage === "planning"
                        ? [session.baseMessage, session.plan.instructionsBefore]
                            .filter(Boolean)
                            .join("\n")
                        : session.candidatePrefix,
                  }).length,
                  completed: false,
                  calls: session.plan?.calls ?? [],
                  validationError: session.candidateValidationError,
                },
              }
            : {}),
        },
      },
    },
  };
}
