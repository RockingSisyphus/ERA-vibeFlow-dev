import {
  applyStageCalls,
  consumeStagePrefix,
  rejectStageOperation,
} from "../../base_lib/agent/agent_stage_program.ts";
import { advanceEraSyncBlock } from "../../base_lib/domain/sync/sync_block.ts";
import { syncFailure } from "../../base_lib/sync/sync_contracts.ts";
import type { EraBlockStepStateV1 } from "../../base_lib/sync/sync_contracts.ts";
import {
  callAnchor,
  currentFunctionBlock,
  replaceFunctionText,
  finishFunction,
  prepareFunctionApi,
  functionApiSettlement,
} from "../../base_lib/sync/function_block_execution.ts";

/** One block owner: function waits yield requests back to this same loop. */
export async function run(
  inputs: any,
  _params: any,
  context: any,
): Promise<any> {
  let state = inputs["era.sync.block.step.state"].value as EraBlockStepStateV1;
  const functions = context.capabilities["era.tavern.functions"];
  try {
    if (
      state.done ||
      state.work.plan === null ||
      state.work.disposition === "failed"
    ) {
      const frame = state.functionFrame;
      if (frame) {
        if (frame.request && state.work.failure)
          functions.acknowledge({
            id: frame.id,
            requestId: frame.request.id,
            settlement: functionApiSettlement(
              state,
              frame.request,
              null,
              state.work.failure,
            ),
          });
        functions.release({ id: frame.id });
      }
      return {
        block_step_pending: { ...state, done: true, functionFrame: null },
      };
    }
    const frame = state.functionFrame;
    if (frame?.phase === "start") {
      const { block } = currentFunctionBlock(state);
      if (block.call.diagnostics.length > 0) {
        return {
          block_step_pending: consumeStagePrefix(
            finishFunction(state, {
              code: block.call.diagnostics[0].code,
              message: block.call.diagnostics
                .map((item: any) => item.message)
                .join(" "),
            }),
          ),
        };
      }
      functions.begin({
        id: frame.id,
        name: block.call.name,
        args: block.call.args,
        sourceBasis: state.sourceBasis,
      });
      return {
        block_step_pending: {
          ...state,
          functionFrame: { ...frame, phase: "waiting" },
        },
      };
    }
    if (frame && (frame.phase === "waiting" || frame.remaining === 0)) {
      if (frame.request) {
        functions.acknowledge({
          id: frame.id,
          requestId: frame.request.id,
          settlement: functionApiSettlement(
            state,
            frame.request,
            frame.request.receiptValue,
          ),
        });
        state = {
          ...state,
          functionFrame: { ...frame, phase: "waiting", request: null },
        };
      }
      const incoming = await functions.next({ id: frame.id });
      if (incoming.kind === "done") {
        const completed = consumeStagePrefix(
          finishFunction(state, incoming.error),
        );
        functions.release({ id: frame.id });
        return { block_step_pending: completed };
      }
      const identity = context.capabilities["era.tavern.identity"].read({
        purpose: "era-function-api",
      });
      if (incoming.type !== "era.facade.commit") {
        functions.acknowledge({
          id: frame.id,
          requestId: incoming.id,
          settlement: functionApiSettlement(state, incoming, null, {
            code: "ERA_FUNCTION_SYNC_UNSUPPORTED",
            message: "消息内函数禁止重算或回退，请在调用结束后由外部发起。",
            layer: "domain",
          }),
        });
        return { block_step_pending: state };
      }
      const prepared = prepareFunctionApi(state, incoming, identity);
      if (prepared.settlement)
        functions.acknowledge({
          id: frame.id,
          requestId: incoming.id,
          settlement: prepared.settlement,
        });
      return { block_step_pending: prepared.state };
    }
    if (!frame) {
      const calls = applyStageCalls(state);
      if (calls) return { block_step_pending: calls };
    }
    const beforeDiagnostics = state.work.plan.diagnostics.length;
    const beforeExecution =
      state.work.plan.status !== "failed" ? state.work.plan.execution : null;
    const step = advanceEraSyncBlock(state.work.plan, true, true);
    if (step.pendingCall) {
      const execution = (step.plan as any).execution;
      const id = `${state.work.step.stepId}:call:${execution.messageIndex}:${execution.blockIndex}`;
      state = {
        ...state,
        work: { ...state.work, plan: step.plan },
        functionFrame: {
          id,
          callIndex: execution.blockIndex,
          appliedBlocks: 0,
          phase: "start",
          remaining: 0,
          request: null,
        },
      };
      const { text } = currentFunctionBlock(state);
      return {
        block_step_pending: replaceFunctionText(
          state,
          text.slice(0, step.pendingCall.end) +
            callAnchor(state) +
            text.slice(step.pendingCall.end),
        ),
      };
    }
    const work =
      step.failure === null
        ? { ...state.work, plan: step.plan }
        : {
            ...state.work,
            disposition: "failed" as const,
            failure: syncFailure(
              step.failure.code,
              step.failure.message,
              "domain",
            ),
          };
    const consumed =
      !frame &&
      beforeExecution &&
      state.work.plan.messages[beforeExecution.messageIndex]?.messageId ===
        (state.stageOutcome as any)?.stageWorkInput?.stageFloor?.messageId
        ? consumeStagePrefix(state)
        : state;
    return {
      block_step_pending: rejectStageOperation(
        {
          ...consumed,
          done: step.done,
          work,
          ...(frame?.phase === "applying"
            ? { functionFrame: { ...frame, remaining: frame.remaining - 1 } }
            : {}),
        },
        beforeDiagnostics,
      ),
    };
  } catch (error) {
    const reason =
      (error as any)?.code === "VF_CAPABILITY_FAILED"
        ? (error as any).cause
        : error;
    if (state.functionFrame) {
      try {
        functions.release({ id: state.functionFrame.id });
      } catch {
        /* The cancelled host already owns cleanup. */
      }
    }
    return {
      block_step_pending: {
        ...state,
        done: true,
        functionFrame: null,
        work: {
          ...state.work,
          disposition: "failed",
          failure: syncFailure(
            reason?.code ?? "ERA_FUNCTION_CONTEXT_FAILED",
            reason instanceof Error ? reason.message : String(reason),
            "tavern",
          ),
        },
      },
    };
  }
}
