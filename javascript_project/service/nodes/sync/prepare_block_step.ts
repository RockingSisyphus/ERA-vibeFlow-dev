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
import { appliedRecordDrawOffset } from "../../base_lib/domain/message_function_calls.ts";
import { planSyncWork } from "../../base_lib/sync_planning.ts";
import type { SyncContextV1 } from "../../base_lib/sync_contracts.ts";

interface Envelope<T> {
  readonly value: T;
}

/**
 * 取出可用于本次续做的游标。
 *
 * 只有游标身份与当前处理楼层完全一致才可续做：楼层对不上说明游标属于另一条消息（切聊、
 * 回退或用户编辑过的旧楼），此时必须退回「从楼层起点重算」；`done` 为真的游标说明那条
 * 楼层已经算完，也不该再续做。
 */
function resumableCursor(
  context: SyncContextV1,
  floor: { readonly messageId: number; readonly mk: string } | null,
): {
  readonly blockIndex: number;
  readonly stat: Readonly<Record<string, unknown>>;
  readonly statFunc: Readonly<Record<string, unknown>>;
} | null {
  const cursor = context.syncCursor;
  if (cursor === null || cursor === undefined || floor === null) return null;
  if (cursor.messageId !== floor.messageId || cursor.mk !== floor.mk) return null;
  if (cursor.done === true) return null;
  return {
    blockIndex: cursor.blockIndex,
    stat: cursor.stat ?? {},
    statFunc: cursor.statFunc ?? {},
  };
}

export function prepare(
  inputs: Readonly<{ "era.sync.context": Envelope<unknown> }>,
): any {
  const context = inputs["era.sync.context"].value as SyncContextV1;
  const floor = processingFloor(context);
  const world = committedWorld(context);
  const resume = resumableCursor(context, floor);
  const state: EraBlockStepStateV1 = {
    messageId: floor?.messageId ?? 0,
    mk: floor?.mk ?? "",
    // 有可续做的游标时从「已提交块的下一块」继续：已提交的块不能再重放，否则
    // `$expr` 这类非幂等操作会被算两遍。
    blockIndex: resume === null ? 0 : resume.blockIndex + 1,
    // 没有处理楼层时没有可推进的块，直接标记处理完，避免循环空转。
    done: floor === null,
    stat: resume?.stat ?? world.stat,
    statFunc: resume?.statFunc ?? world.statFunc,
    // 已提交世界必须单独留存：`stat`/`statFunc` 会随块推进被覆盖，而交接时的记录提交、
    // 以及「这条楼层还没处理完」的连续处理事实都要回到本批次开始时的值。
    baseStat: resume?.stat ?? world.stat,
    baseStatFunc: resume?.statFunc ?? world.statFunc,
    consecutive: context.consecutive,
    route: "none",
    executedBlockIndex: null,
    // 被中断的楼层把「已抽了多少次」留在记录里：续做必须从这里接着抽。
    drawOffset: appliedRecordDrawOffset(floor?.text ?? ""),
    // 逐块提交由循环体完成；收口节点靠这个事实决定是否还要写楼层文本。
    committedPerBlock: false,
    handoff: null,
    content: floor?.text ?? "",
    meta: world.meta,
    work: planSyncWork(context) as unknown as Readonly<Record<string, unknown>>,
  };
  return {
    block_step_state: state as unknown as Readonly<Record<string, unknown>>,

  };
}
