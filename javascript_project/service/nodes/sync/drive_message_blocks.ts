/**
 * 块步进：每次只推进一个块，并把「遇调用即断开」表达为状态。
 *
 * 本节点是块步进循环的 body 节点。它从承载状态恢复流程、推进一个块、返回下一个
 * 状态；遇到无标记 `<EraFCall/>` 时把路由置为 `invoke` 并把交接事实写进状态，
 * 由循环结束、再由收口节点把工作项声明为不提交。函数始终由 Host 在步骤之外执行。
 *
 * 为什么状态由外层携带而不是本节点持有：循环的每次迭代都是独立步骤，块进度、
 * 累计变量与待交接调用必须能随迭代传递；跨批次恢复按「从楼层起点重算」执行。
 */

import {
  committedWorld,
  handoffOf,
  processingFloor,
  record,
  type EraBlockStepStateV1,
} from "../../base_lib/block_step_state.ts";
import {
  advanceMessageFunctionFlow,
  rehydrateMessageFunctionFlow,
} from "../../base_lib/domain/message_function_flow.ts";
import type { SyncContextV1 } from "../../base_lib/sync_contracts.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(
  inputs: Readonly<{
    "era.sync.context": Envelope<unknown>;
    "era.sync.block.step.state": Envelope<unknown>;
  }>,
): any {
  const context = inputs["era.sync.context"].value as SyncContextV1;
  const state = inputs["era.sync.block.step.state"].value as EraBlockStepStateV1;
  const floor = processingFloor(context);

  // 没有处理楼层或状态已经指向交接：不动状态，直接结束本次块驱动。
  if (floor === null || state.route === "invoke") {
    return {
      block_step_state_next: state,
      block_step_done: true,
    };
  }

  const flow = rehydrateMessageFunctionFlow({
    cursor: {
      messageId: floor.messageId,
      mk: floor.mk,
      blockIndex: state.blockIndex,
      done: state.done,
    },
    content: floor.text,
    messageId: floor.messageId,
    mk: floor.mk,
    initialStat: state.stat,
    initialStatFunc: state.statFunc,
    meta: committedWorld(context).meta,
    formal: true,
  });
  const advanced = advanceMessageFunctionFlow(flow);
  const pending = advanced.pendingCall;
  const next: EraBlockStepStateV1 = {
    messageId: floor.messageId,
    mk: floor.mk,
    blockIndex: advanced.cursor.blockIndex,
    done: advanced.done,
    stat: record(advanced.stat) ? advanced.stat : {},
    statFunc: advanced.statFunc ?? state.statFunc,
    route: pending === null || pending.name === null ? "none" : "invoke",
    handoff:
      pending === null || pending.name === null
        ? null
        : handoffOf({
            floor,
            call: pending,
            blockIndex: advanced.cursor.blockIndex,
            flow: advanced,
          }),
  };
  return {
    block_step_state_next: next,
    // 本次块驱动结束：整条消息处理完，或已经把调用交接出去。
    block_step_done: next.done || next.route === "invoke",
  };
}
