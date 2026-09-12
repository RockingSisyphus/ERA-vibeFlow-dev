import type { EraBlockStepStateV1 } from "../../base_lib/block_step_state.ts";
/** 压缩沿用普通工作项，仅应用器给出的已完成封存楼层成为候选。 */
export function run(inputs: any): any {
  const state = inputs["era.sync.block.step.pending"]
    .value as EraBlockStepStateV1;
  return {
    expression_command_result: {
      ...state.work,
      blockStepState: state as unknown as Readonly<Record<string, unknown>>,
    },
  };
}
