/** 逐块提交收口：折回提交结果并产出循环体声明的下一个状态。 */
import {
  foldBlockCommitOutcome,
  type EraBlockStepStateV1,
} from "../../base_lib/block_step_state.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(
  inputs: Readonly<{ "era.tavern.commit.result": Envelope<unknown> }>,
): any {
  const outcome = inputs["era.tavern.commit.result"].value as {
    readonly mode?: string;
    readonly blockStepState?: unknown;
    readonly work?: { readonly blockStepState?: unknown };
  };
  const carried =
    outcome.mode === "non-commit"
      ? outcome.work?.blockStepState
      : outcome.blockStepState;
  if (carried === null || carried === undefined || typeof carried !== "object") {
    throw new TypeError(
      "ERA_BLOCK_COMMIT_STATE_MISSING: 逐块提交结果没有带回块步进状态。",
    );
  }
  return {
    folded_block_step_state: foldBlockCommitOutcome({
      state: carried as EraBlockStepStateV1,
      outcome: outcome as never,
    }) as unknown as Readonly<Record<string, unknown>>,
  };
}
