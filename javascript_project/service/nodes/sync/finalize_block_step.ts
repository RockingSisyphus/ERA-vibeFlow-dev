/**
 * 块步进循环的收口节点：把最终块步进状态收口为下游消费的同步工作项。
 *
 * 有待交接调用时工作项必须声明为不提交（`plan`/`payload` 归 null）：函数效果只能由
 * 它自己的操作区记录带来，先提交半条消息会让侧车状态与消息文本对不上，也会让恢复
 * 后的重放把前段块的效果算两次。
 */

import type { EraBlockStepStateV1 } from "../../base_lib/block_step_state.ts";
import { planSyncWork } from "../../base_lib/sync_planning.ts";
import type { SyncContextV1, SyncWorkV1 } from "../../base_lib/sync_contracts.ts";

interface Envelope<T> {
  readonly value: T;
}

export function finalize(
  inputs: Readonly<{
    "era.sync.context": Envelope<unknown>;
    "era.sync.block.step.state.next": Envelope<unknown>;
  }>,
): any {
  const context = inputs["era.sync.context"].value as SyncContextV1;
  const state = inputs["era.sync.block.step.state.next"].value as EraBlockStepStateV1;
  const work = planSyncWork(context);
  const handoff = state.route === "invoke" ? state.handoff : null;
  if (handoff === null || work.disposition === "failed") {
    return {
      expression_command_result: work as unknown as Readonly<Record<string, unknown>>,
      function_invocation_route: "none",
    };
  }
  const deferred: SyncWorkV1 = {
    ...work,
    disposition: "no-op",
    plan: null,
    payload: null,
    failure: null,
    handoff,
  };
  return {
    expression_command_result: deferred as unknown as Readonly<Record<string, unknown>>,
    function_invocation_route: "invoke",
  };
}
