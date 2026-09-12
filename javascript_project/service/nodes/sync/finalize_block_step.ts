/**
 * 块步进循环的收口节点：把「预规划好的同步工作项」按块步进结果收口。
 *
 * 为什么工作项由准备节点预规划：内核的数据流是线性消费（一个产出值只能被一个节点消费），
 * 收口节点若再消费一次同步上下文就永远不会被调度，表现为所属节点集退不出、声明输出实得 0。
 * 而计划只依赖该消息的静态文本与已提交状态，在循环之前或之后计算等价。
 *
 * 有待交接调用时提交的是**记录**而不是状态：调用块上的 `status="done"`、已落盘的操作区
 * 与 MK 必须写进消息文本，否则下一次恢复读不到「哪些调用处理过」，两处调用会互相丢掉对方的
 * 标记并形成永不前进的交接循环。状态停在已提交世界，恢复时整楼重放恰好一次。构造与理由见
 * `buildHandoffRecordWork`。
 */

import { buildHandoffRecordWork, type EraBlockStepStateV1 } from "../../base_lib/block_step_state.ts";
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
  // 来源在提交期间被改掉（换 swipe/重新生成/编辑）：整批次工作作废。尾链**什么都不能写**：
  // 不写文本（那是旧分支的文本）、不写续做点（`syncCursor` 属于作废的版本，写了会让新版本
  // 从错误的世界续做）、也不声明呈现意图。新事件会从楼层起点重算这条楼层。
  // 这一支必须排在下面的早退之前：作废批次连「原样放行工作项」都不行。
  if (state.superseded === true) {
    const supersededTail: SyncWorkV1 = {
      ...work,
      disposition: "no-op",
      failure: null,
    };
    return {
      expression_command_result: supersededTail as unknown as Readonly<Record<string, unknown>>,
      function_invocation_route: "none",
    };
  }
  if (handoff === null || work.disposition === "failed") {
    return {
      expression_command_result: work as unknown as Readonly<Record<string, unknown>>,
      function_invocation_route: "none",
    };
  }
  // 已由循环逐块提交的楼层：写入（含整层记账）都在循环体里完成，尾链**完全不提交**——同一批次里
  // 它再做任何提交，basis 都已过期。它只走「不提交也能发布」的路：续做点与收尾呈现意图。
  if (state.committedPerBlock === true) {
    const floorIdentity = (
      work.step as { readonly dispatchContext?: { readonly floorIdentity?: unknown } }
    ).dispatchContext?.floorIdentity;
    const noOpTail: SyncWorkV1 = {
      ...work,
      disposition: "no-op",
      syncCursor: state.done
        ? null
        : {
            messageId: state.messageId,
            mk: state.mk,
            blockIndex: Math.max(0, state.blockIndex - 1),
            stat: state.stat,
            statFunc: state.statFunc,
          },
      initialPresentation: state.done ? ((floorIdentity ?? null) as never) : null,
      failure: null,
      ...(handoff === null ? {} : { handoff }),
    };
    return {
      expression_command_result: noOpTail as unknown as Readonly<Record<string, unknown>>,
      function_invocation_route: handoff === null ? "none" : "invoke",
    };
  }
  // 记录提交以「预规划工作项可用」为前提；不可用时保持不提交，宁可这一批不落盘也不能
  // 凭空造一份状态提交。
  const recorded = buildHandoffRecordWork({ work, state });
  if (recorded.disposition !== "commit") {
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
  return {
    expression_command_result: {
      ...recorded,
      handoff,
    } as unknown as Readonly<Record<string, unknown>>,
    function_invocation_route: "invoke",
  };
}
