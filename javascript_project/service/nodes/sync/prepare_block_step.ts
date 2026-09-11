/**
 * 块步进循环的准备节点：从同步上下文建立初始块步进状态。
 *
 * 累计变量必须从已提交侧车状态出发：位置状态是「这条消息之前已提交的状态」，
 * 从空对象出发会让函数与后续块读到空世界。
 */

import {
  committedWorld,
  processingFloor,
  type EraBlockStepStateV1,
} from "../../base_lib/block_step_state.ts";
import type { SyncContextV1 } from "../../base_lib/sync_contracts.ts";

interface Envelope<T> {
  readonly value: T;
}

export function prepare(
  inputs: Readonly<{ "era.sync.context": Envelope<unknown> }>,
): any {
  const context = inputs["era.sync.context"].value as SyncContextV1;
  const floor = processingFloor(context);
  const world = committedWorld(context);
  const state: EraBlockStepStateV1 = {
    messageId: floor?.messageId ?? -1,
    mk: floor?.mk ?? "",
    blockIndex: 0,
    // 没有处理楼层时没有可推进的块，直接标记处理完，避免循环空转。
    done: floor === null,
    stat: world.stat,
    statFunc: world.statFunc,
    route: "none",
    handoff: null,
  };
  return {
    block_step_state: state as unknown as Readonly<Record<string, unknown>>,
  };
}
