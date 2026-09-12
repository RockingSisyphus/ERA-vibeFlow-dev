import { basisAfterSyncWrites } from "../../base_lib/sync_commit_policy.ts";
import {
  syncFailure,
  type SyncCommitResultV1,
} from "../../base_lib/sync_contracts.ts";
import type { EraBlockStepStateV1 } from "../../base_lib/block_step_state.ts";
/** 只有实际保存完成后才能推进来源版本；失败不扔成内核 fatal。 */
export function run(inputs: any): any {
  const outcome = inputs["era.tavern.commit.result"].value;
  const state = (
    outcome.mode === "non-commit"
      ? outcome.work.blockStepState
      : outcome.blockStepState
  ) as EraBlockStepStateV1;
  if (!state) throw new TypeError("ERA_BLOCK_COMMIT_STATE_MISSING");
  let next = state;
  if (outcome.mode !== "non-commit") {
    const { blockStepState: _carried, ...result } = outcome;
    if (result.status === "committed" && result.sourceChanged !== true) {
      next = {
        ...state,
        sourceBasis: basisAfterSyncWrites(result),
        lastResult: result as SyncCommitResultV1,
      };
    } else {
      next = {
        ...state,
        done: true,
        work: {
          ...state.work,
          // 未保存的候选不能发布连续处理状态或清除已保存的续做点。
          plan: state.lastResult?.plan ?? null,
          ...(state.lastResult === null
            ? {}
            : { syncCursor: state.lastResult.syncCursor }),
          disposition:
            result.sourceChanged && result.status !== "failed"
              ? "no-op"
              : "failed",
          failure:
            result.sourceChanged && result.status !== "failed"
              ? null
              : (result.failure ??
                syncFailure(
                  "ERA_BLOCK_COMMIT_FAILED",
                  "逐块保存失败。",
                  "tavern",
                )),
        },
      };
    }
  }
  return { folded_block_step_state: next, block_step_done: next.done };
}
