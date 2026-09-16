import type { EraBlockStepStateV1 } from "./block_step_state.ts";
import { advanceEraSyncBlock } from "./domain/sync_engine.ts";
import { AgentFunctionCallFailure, executeAgentFunctionCalls } from "./agent_generation_session.ts";
import { syncFailure } from "./sync_contracts.ts";

function inputOf(state: EraBlockStepStateV1): any {
  return (state.stageOutcome as any)?.stageWorkInput;
}
function withProgram(
  state: EraBlockStepStateV1,
  program: any,
): EraBlockStepStateV1 {
  return {
    ...state,
    stageOutcome: {
      ...state.stageOutcome,
      stageWorkInput: { ...inputOf(state), program },
    },
  };
}

/** Counts source blocks, not the API records inserted while executing a call. */
export function consumeStagePrefix(
  state: EraBlockStepStateV1,
): EraBlockStepStateV1 {
  const input = inputOf(state);
  const program = input?.program;
  const plan = state.work.plan;
  const execution = plan && plan.status !== "failed" ? plan.execution : null;
  if (!program || program.completed || program.remaining <= 0 || !plan || !execution ||
      plan.messages[execution.messageIndex]?.messageId !== input.stageFloor.messageId)
    return state;
  return withProgram(state, { ...program, remaining: program.remaining - 1 });
}

/** Execute the JSON calls at their position using the common floor origin/cursor. */
export function applyStageCalls(
  state: EraBlockStepStateV1,
): EraBlockStepStateV1 | null {
  const input = inputOf(state);
  const program = input?.program;
  const plan = state.work.plan;
  const execution = plan && plan.status !== "failed" ? plan.execution : null;
  if (
    !program ||
    program.completed ||
    program.remaining !== 0 ||
    !plan ||
    !execution ||
    plan.messages[execution.messageIndex]?.messageId !==
      input.stageFloor.messageId
  )
    return null;
  const prepared = advanceEraSyncBlock(plan, true, true, true).plan;
  try {
    if (program.validationError) throw new Error(program.validationError);
    const executed = executeAgentFunctionCalls({
      calls: program.calls,
      statData: prepared.stat,
      statFunc: prepared.statFunc,
      sourceKey: input.session.sourceKey ?? input.stageFloor.mk,
      drawOffset: input.session.nextDrawOffset ?? 0,
    });
    return withProgram(
      { ...state, work: { ...state.work, plan: prepared } },
      {
        ...program,
        completed: true,
        results: executed.results,
        nextDrawOffset: executed.nextDrawOffset,
      },
    );
  } catch (error) {
    return withProgram({
      ...state,
      done: true,
      work: {
        ...state.work,
        plan: prepared,
        disposition: "failed",
        failure: syncFailure(
          "ERA_AGENT_CALLS_FAILED",
          error instanceof Error ? error.message : String(error),
          "domain",
        ),
      },
    }, { ...program, ...(error instanceof AgentFunctionCallFailure ? { errorResults: error.functionResults } : {}) });
  }
}

/** Stage candidates reject operation diagnostics; ordinary messages retain their policy. */
export function rejectStageOperation(
  state: EraBlockStepStateV1,
  previousCount: number,
): EraBlockStepStateV1 {
  const stage = (state.stageOutcome as any)?.stageBoundary?.stage;
  if (stage !== "planning" && stage !== "settlement") return state;
  // Author API failures belong to the author; their caught/uncaught behavior is
  // handled by the function owner, not turned into a model correction here.
  if (state.functionFrame) return state;
  const diagnostic = state.work.plan?.diagnostics
    .slice(previousCount)
    .find((item) => !/^ERA_(?:FCALL|FUNCTION_CALL)_/u.test(item.code));
  if (!diagnostic) return state;
  return {
    ...state,
    done: true,
    work: {
      ...state.work,
      disposition: "failed",
      failure: syncFailure(diagnostic.code, diagnostic.message, "domain"),
    },
  };
}
