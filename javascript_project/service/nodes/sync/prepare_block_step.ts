import { planSyncWork } from "../../base_lib/sync_planning.ts";
import {
  dispatchContext,
  type SyncContextV1,
} from "../../base_lib/sync_contracts.ts";
import type { EraBlockStepStateV1 } from "../../base_lib/block_step_state.ts";
/** 只准备历史回退及待处理区间，不提前应用任何消息操作。 */
export function prepare(inputs: any): any {
  const context = inputs["era.sync.context"].value as SyncContextV1;
  const work = planSyncWork(context, true);
  const prepared = dispatchContext(work.step);
  const state: EraBlockStepStateV1 = {
    work,
    done: work.disposition !== "commit",
    sourceBasis:
      prepared.schemaVersion === 3 ? (prepared.sourceBasis ?? null) : null,
    ...(context.scopeWindow ? { scopeWindow: context.scopeWindow } : {}),
  };
  return { block_step_state: state };
}
