/**
 * 块步进循环的收口节点：把「预规划好的同步工作项」按块步进结果收口。
 *
 * 为什么工作项由准备节点预规划：内核的数据流是线性消费（一个产出值只能被一个节点消费），
 * 收口节点若再消费一次同步上下文就永远不会被调度，表现为所属节点集退不出、声明输出实得 0。
 * 而计划只依赖该消息的静态文本与已提交状态，在循环之前或之后计算等价。
 *
 * 有待交接调用时工作项必须声明为不提交（`plan`/`payload` 归 null）：函数效果只能由它自己的
 * 操作区记录带来，先提交半条消息会让侧车状态与消息文本对不上，也会让恢复后的重放把前段块的效果算两次。
 */

import type { EraBlockStepStateV1 } from "../../base_lib/block_step_state.ts";
import type { SyncWorkV1 } from "../../base_lib/sync_contracts.ts";

interface Envelope<T> {
  readonly value: T;
}

export function finalize(
  inputs: Readonly<{
    "era.sync.block.step.state.next": Envelope<unknown>;
  }>,
): any {
  const state = inputs["era.sync.block.step.state.next"].value as EraBlockStepStateV1;
  const work = state.work as unknown as SyncWorkV1;
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
