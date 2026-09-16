import { formatAgentPlanReport } from "../../base_lib/agent_generation_session.ts";
import { stripEraDataBlocks } from "../../base_lib/domain/mk_engine.ts";
import { prepareSessionWrite } from "../../base_lib/agent_session_binding.ts";

/** Store the applied draft/stage text in the existing Agent session, without saving chat or Sidecar. */
export function run(inputs: any, _params: any, runtime: any): any {
  const state = inputs["era.sync.block.step.state.next"].value;
  const { stageWorkInput: input, ...outcome } = state.stageOutcome;
  const session = input.session ?? {};
  const existingFloor = session.stageMemory;
  if (outcome.value?.status === "generation-cancelled") {
    const sidecar = runtime.capabilities["era.tavern.sidecar"];
    const working = sidecar.read_working({}).working;
    if (working?.stage) {
      const actual = input.step?.dispatchContext?.sourceBasis?.messages ?? working.sourceBasis?.messages ?? [];
      if (!actual.some((message: any) => message.messageId === working.stage.messageId)) {
        // A completed plan can still belong to a future AI floor. Keep the
        // rollback logs, but remove its draft overlay before replaying actual history.
        sidecar.write_working({ ...working, expectedVersion: working.version, work: null, stage: null });
      }
      // Earlier completed stages are already in the working text/state. A
      // cancellation must not discard them and replay the old persisted text.
      // The normal sync path validates the original source before saving.
      runtime.capabilities["era.lifecycle.admission"].schedule({
        key: "era-working-save",
        delayMs: 0,
        maxDelayMs: 0,
        event: {
          type: "era.facade.sync",
          source: "era-api",
          args: [{ mode: "full" }],
        },
      });
    }
  }
  if (!outcome.stageBoundary || !input.stageFloor) {
    return {
      applied_generation_outcome:
        outcome.candidate &&
        existingFloor?.messageId === outcome.candidate.messageId
          ? {
              ...outcome,
              candidate: { ...outcome.candidate, mk: existingFloor.mk },
              appliedFloor: {
                chatId: existingFloor.chatId,
                messageId: existingFloor.messageId,
                swipeId: existingFloor.swipeId,
                mk: existingFloor.mk,
              },
            }
          : outcome,
    };
  }
  if (state.work.disposition === "failed") {
    const failure = state.work.failure;
    const recovery = input.recovery;
    const stage = outcome.stageBoundary.stage;
    // All candidate-owned calls have left the block loop before this point.
    // Restore the complete working record, text/logs and scope, not inverse
    // guesses based on whichever command happened to fail.
    if (recovery) {
      try {
        const sidecar = runtime.capabilities["era.tavern.sidecar"];
        const current = sidecar.read_working({}).working;
        sidecar.write_working({
          ...recovery.working,
          expectedVersion: current.version,
        });
        const agent = runtime.capabilities["era.tavern.agent"];
        const chatKey = input.request.context.identity.chatId;
        if (recovery.session) {
          agent.write_session(
            prepareSessionWrite(
              { chatKey, session: recovery.session },
              agent.read_session_binding({ chatKey }),
            ),
          );
        } else agent.clear_session({ chatKey });
      } catch (error) {
        return {
          applied_generation_outcome: {
            mode: "execute-only",
            status: "failed",
            diagnostics: [
              {
                code: "ERA_AGENT_CANDIDATE_RESTORE_FAILED",
                message: error instanceof Error ? error.message : String(error),
              },
            ],
          },
        };
      }
    }
    if (
      recovery &&
      failure.category === "domain" &&
      (stage === "planning" || stage === "settlement")
    ) {
      const attempts = [...(session[`${stage}Attempts`] ?? [])];
      const last = attempts.at(-1) ?? { attempt: 0, response: "" };
      attempts[attempts.length - 1] = {
        ...last,
        status: "failed",
        diagnostic: failure.message,
        ...(input.program?.errorResults ? { functionResults: input.program.errorResults } : {}),
      };
      return {
        applied_generation_outcome: {
          mode: "execute-only",
          status: "failed",
          diagnostics: [],
          retryGeneration: {
            ...input.request,
            context: {
              ...input.request.context,
              state: recovery.working.record.state,
              session: recovery.session,
              candidateRetry: {
                stage,
                attempts,
                nextAttempt: Number(last.attempt) + 1,
                failure: {
                  response: session.candidateSourceResponse ?? last.response,
                  diagnostic: failure.message,
                  requestId: last.requestId,
                },
                next: session.pendingStage?.next,
                requiresInitialPresentation:
                  session.pendingStage?.candidate?.requiresInitialPresentation,
              },
            },
          },
        },
      };
    }
    return {
      applied_generation_outcome: {
        mode: "execute-only",
        status: "failed",
        diagnostics: [{ code: failure.code, message: failure.message }],
      },
    };
  }
  const floor = input.stageFloor;
  const message = state.work.plan.messages.find(
    (item: any) => item.messageId === floor.messageId,
  );
  const content = message.content.text;
  const body = stripEraDataBlocks(content).trimEnd();
  const stage = outcome.stageBoundary.stage;
  const {
    candidateStartSession: _start,
    candidateSourceResponse: _response,
    candidateValidationError: _validation,
    candidatePrefix: _prefix,
    ...completedSession
  } = session;
  const updated = { ...completedSession, stageMemory: { ...floor, content } };
  if (stage === "planning") {
    const base = stripEraDataBlocks(String(session.baseMessage ?? ""));
    if (!body.startsWith(base)) throw new Error("ERA_STAGE_PREFIX_CHANGED");
    updated.planningDraft = body.slice(base.length).trimStart();
    if (input.program?.completed) {
      updated.functionResults = input.program.results;
      updated.nextDrawOffset = input.program.nextDrawOffset;
      updated.planReport = formatAgentPlanReport({
        plan: session.plan,
        functionResults: input.program.results,
      });
      updated.planningAttempts = (session.planningAttempts ?? []).map(
        (attempt: any, index: number, all: any[]) =>
          index === all.length - 1
            ? { ...attempt, functionResults: input.program.results.map((result: any) => ({
                ...result, status: "passed",
                ...(session.plan.calls[result.index]?.purpose !== undefined
                  ? { purpose: session.plan.calls[result.index].purpose } : {}),
              })) }
            : attempt,
      );
    }
  } else if (stage === "story") {
    const prefix = stripEraDataBlocks(
      [session.baseMessage, session.planningDraft, session.planReport]
        .filter(Boolean)
        .join("\n"),
    );
    if (!body.startsWith(prefix)) throw new Error("ERA_STAGE_PREFIX_CHANGED");
    updated.story = body.slice(prefix.length).trimStart();
  }
  if (updated.pendingStage?.candidate)
    updated.pendingStage = {
      ...updated.pendingStage,
      candidate: { ...updated.pendingStage.candidate, content, mk: floor.mk },
    };
  const capability = runtime.capabilities["era.tavern.agent"];
  const chatKey = input.request.context.identity.chatId;
  const facts = capability.read_session_binding({ chatKey });
  capability.write_session(
    prepareSessionWrite({ chatKey, session: updated }, facts),
  );
  const sidecar = runtime.capabilities["era.tavern.sidecar"];
  const completedWorking = sidecar.read_working({}).working;
  if (completedWorking?.stage?.candidateRecovery) {
    const { candidateRecovery: _recovery, ...completedStage } = completedWorking.stage;
    sidecar.write_working({ ...completedWorking, expectedVersion: completedWorking.version, stage: completedStage });
  }
  return {
    applied_generation_outcome: {
      ...outcome,
      appliedScopeWindow: state.scopeWindow,
      ...(stage === "planning"
        ? {
            stageBoundary: {
              ...outcome.stageBoundary,
              result: {
                plan: updated.plan,
                functionResults: updated.functionResults,
              },
            },
          }
        : stage === "story"
          ? {
              stageBoundary: {
                ...outcome.stageBoundary,
                result: {
                  ...outcome.stageBoundary.result,
                  story: updated.story,
                },
              },
            }
          : {}),
    },
  };
}
