// Adapters with identical declared base libraries share this source.
import { type EraBlockStepStateV1 } from "../../base_lib/sync/sync_contracts.ts";
import { syncFailure, type SyncWorkV1 } from "../../base_lib/sync/sync_contracts.ts";

function supersededTavernSwipe(state: EraBlockStepStateV1, error: unknown): boolean {
  const step = state.work.step;
  const task = step.kind === "execute" ? step.task : null;
  const changed = error as { code?: unknown; reason?: unknown; written?: unknown } | null;
  return (
    task?.kind === "sync" &&
    task.reason === "history-changed" &&
    task.primaryEvent.source === "tavern" &&
    state.sourceBasis !== null &&
    !state.functionFrame &&
    !state.stageOutcome &&
    changed?.code === "ERA_MESSAGE_WRITE_TARGET_CHANGED" &&
    changed.reason === "swipe" &&
    changed.written === false
  );
}

// Original node: nodes/sync/prepare_block_work.ts
/** 压缩沿用普通工作项，仅应用器给出的已完成封存楼层成为候选。 */
export function PrepareBlockWorkNode(inputs: any): any {
  const state = inputs["era.sync.block.step.pending"]
    .value as EraBlockStepStateV1;
  return {
    expression_command_result: {
      ...state.work,
      blockStepState: state as unknown as Readonly<Record<string, unknown>>,
    },
  };
}

// Original node: nodes/sync/publish_block_application.ts
/** Fold the actual block result, without a persistence transaction per block. */
export function PublishBlockApplicationNode(inputs: any, _params: any, context: any): any {
  const carried = inputs["era.command_compaction.result"].value as SyncWorkV1;
  const state = carried.blockStepState as unknown as EraBlockStepStateV1;
  const { blockStepState: _carried, ...work } = carried;
  // A failed application still needs one turn through the call owner to reject
  // the pending commit and release the author function before the loop exits.
  const next: EraBlockStepStateV1 = {
    ...state,
    work,
    done:
      work.disposition === "failed" && state.functionFrame ? false : state.done,
  };
  try {
    if (work.plan && work.plan.status !== "failed") {
      const sidecar = context.capabilities["era.tavern.sidecar"];
      const previous = sidecar.read_working({}).working;
      if (!previous) throw new Error("ERA_WORKING_STATE_MISSING");
      const { SidecarId: _pointer, ...eraMeta } = work.plan.meta;
      sidecar.write_working({
        expectedVersion: previous.version,
        record: {
          ...previous.record,
          state: {
            statData: work.plan.stat,
            statFunc: work.plan.statFunc,
            eraMeta,
          },
        },
        work,
        sourceBasis: state.sourceBasis,
        dirty: true,
        stage: (state.stageOutcome as any)?.stageWorkInput?.stageFloor
          ? {
              ...(state.stageOutcome as any).stageWorkInput.stageFloor,
              phase: (state.stageOutcome as any).stageBoundary.stage,
              candidateRecovery: (state.stageOutcome as any).stageWorkInput.recovery,
            }
          : (previous.stage ?? null),
      });
    }
  } catch (error) {
    const unwrapped =
      (error as any)?.code === "VF_CAPABILITY_FAILED"
        ? (error as any).cause
        : error;
    // A later native Swipe superseded this ordinary history snapshot before
    // write_working could publish it. The Host rejects the write before any
    // side effect; settle_saved_batch schedules a fresh full history sync.
    const superseded = supersededTavernSwipe(state, unwrapped);
    const failed = {
      ...work,
      disposition: superseded ? ("no-op" as const) : ("failed" as const),
      plan: null,
      ...(superseded ? { payload: null, initialPresentation: null } : {}),
      failure: syncFailure(
        unwrapped?.code ?? "ERA_WORKING_APPLICATION_FAILED",
        unwrapped instanceof Error ? unwrapped.message : String(unwrapped),
        "tavern",
      ),
    };
    const done = !state.functionFrame;
    return {
      block_step_state_after: { ...state, work: failed, done },
      block_step_done: done,
    };
  }
  return { block_step_state_after: next, block_step_done: next.done };
}
