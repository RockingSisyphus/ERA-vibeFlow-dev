import { advanceEraSyncBlock } from "../../base_lib/domain/sync_engine.ts";
import { syncFailure } from "../../base_lib/sync_contracts.ts";
import type { EraBlockStepStateV1 } from "../../base_lib/block_step_state.ts";
/** 应用一个块；未实现调用返回任务级失败，并保留之前所有成功提交。 */
export function run(inputs: any): any {
  const state = inputs["era.sync.block.step.state"]
    .value as EraBlockStepStateV1;
  if (state.done || state.work.plan === null)
    return { block_step_pending: state };
  const step = advanceEraSyncBlock(state.work.plan);
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
  return { block_step_pending: { ...state, done: step.done, work } };
}
