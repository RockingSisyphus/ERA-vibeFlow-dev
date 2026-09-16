import type { EraBlockStepStateV1 } from "../../base_lib/block_step_state.ts";
import { syncFailure, type SyncWorkV1 } from "../../base_lib/sync_contracts.ts";

/** Fold the actual block result, without a persistence transaction per block. */
export function run(inputs: any, _params: any, context: any): any {
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
    const failed = {
      ...work,
      disposition: "failed" as const,
      plan: null,
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
