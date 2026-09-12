import type { EraBlockStepStateV1 } from "../../base_lib/block_step_state.ts";
/** 尾链只呈现和通知，返回实际保存结果，不再次提交业务状态。 */
export function finalize(inputs: any): any {
  const state = inputs["era.sync.block.step.state.next"]
    .value as EraBlockStepStateV1;
  return {
    completed_sync_result:
      state.work.disposition === "commit" && state.lastResult !== null
        ? state.lastResult
        : { mode: "non-commit", work: state.work },
  };
}
