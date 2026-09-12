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
  handoffOf,
  record,
  type EraBlockStepStateV1,
} from "../../base_lib/block_step_state.ts";
import {
  advanceMessageFunctionFlow,
  rehydrateMessageFunctionFlow,
} from "../../base_lib/domain/message_function_flow.ts";
interface Envelope<T> {
  readonly value: T;
}

export function run(
  inputs: Readonly<{
    "era.sync.block.step.state": Envelope<unknown>;
  }>,
): any {
  const state = inputs["era.sync.block.step.state"].value as EraBlockStepStateV1;
  // 没有可推进的块（done 已为真，含「没有处理楼层」）或状态已指向交接：不动状态，直接结束本次块驱动。
  if (state.done || state.route === "invoke") {
    return {
      block_step_state_next: state,
      block_step_done: true,
    };
  }

  const flow = rehydrateMessageFunctionFlow({
    cursor: {
      messageId: state.messageId,
      mk: state.mk,
      blockIndex: state.blockIndex,
      done: state.done,
    },
    content: state.content,
    messageId: state.messageId,
    mk: state.mk,
    initialStat: state.stat,
    initialStatFunc: state.statFunc,
    meta: state.meta,
    formal: true,
  });
  const advanced = advanceMessageFunctionFlow(flow);
  const pending = advanced.pendingCall;
  const next: EraBlockStepStateV1 = {
    messageId: state.messageId,
    mk: state.mk,
    blockIndex: advanced.cursor.blockIndex,
    done: advanced.done,
    stat: record(advanced.stat) ? advanced.stat : {},
    statFunc: advanced.statFunc ?? state.statFunc,
    // 已提交世界与连续处理事实在所有迭代中原样携带：交接/收口只认这两个值。
    baseStat: state.baseStat,
    baseStatFunc: state.baseStatFunc,
    consecutive: state.consecutive,
    route: pending === null || pending.name === null ? "none" : "invoke",
    // 本次迭代真正推进的块（最多一个）：交接迭代不推进任何块，因此这里为 null。
    executedBlockIndex: advanced.executedBlockIndexes[0] ?? null,
    // 累加抽取次数：本次推进消耗的抽取从这里接着记，逐块提交时写进记录。
    drawOffset: state.drawOffset + advanced.cursor.randomDrawOffset,
    committedPerBlock: state.committedPerBlock,
    ...(state.superseded === true ? { superseded: true } : {}),
    content: state.content,
    meta: state.meta,
    work: state.work,
    handoff:
      pending === null || pending.name === null
        ? null
        : handoffOf({
            floor: { messageId: state.messageId, mk: state.mk },
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
