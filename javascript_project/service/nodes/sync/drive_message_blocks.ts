/**
 * 一步一块：驱动一条消息的块序列，并产出下游既有节点消费的同步工作项。
 *
 * 本节点取代原先「准备请求 + 一次性重放」两步：它在同一个 run 内按块推进会话，
 * 遇到无标记 `<EraFCall/>` 时把路由置为 `invoke` 并把待调用交回调用方；
 * 函数本体不在本节点内执行（B3 接入 Capability 与 Host 绑定会话）。
 *
 * 工作项仍由登记的 sync_planning 纯函数产出，因此与既有提交链完全兼容；
 * 块游标随结果报出，供跨步骤续做使用。
 */

import {
  advanceMessageFunctionFlow,
  startMessageFunctionFlow,
  type MessageFunctionFlow,
} from "../../base_lib/domain/message_function_flow.ts";
import type { EraFunctionCallSite } from "../../base_lib/domain/message_function_calls.ts";
import { planSyncWork } from "../../base_lib/sync_planning.ts";
import type { SyncContextV1 } from "../../base_lib/sync_contracts.ts";

interface Envelope<T> {
  readonly value: T;
}

const MAX_BLOCKS_PER_RUN = 64;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 从派发上下文取出当前处理楼层的消息身份与文本。 */
function processingFloor(
  context: SyncContextV1,
): { readonly messageId: number; readonly mk: string; readonly text: string } | null {
  const step = context.step;
  const dispatch = record(step) ? step.dispatchContext : null;
  if (!record(dispatch)) return null;
  const message = record(dispatch.processingMessage)
    ? dispatch.processingMessage
    : null;
  if (!record(message)) return null;
  const messageId = message.messageId;
  const text = message.activeText;
  const mk = dispatch.processingMk;
  if (!Number.isSafeInteger(messageId) || typeof text !== "string") return null;
  return {
    messageId: Number(messageId),
    mk: typeof mk === "string" && mk.length > 0 ? mk : "",
    text,
  };
}

/**
 * 按块推进一条消息，返回流程状态与需要宿主机执行的调用。
 *
 * 每次推进只处理一个块；遇到未处理调用立即停止，函数由宿主机在块边界之外执行。
 * 流程状态自带块游标与累计状态，因此可以随步骤跨批次携带。
 */
function driveBlocks(
  text: string,
  messageId: number,
  mk: string,
  formal: boolean,
): { readonly flow: MessageFunctionFlow; readonly pendingCall: EraFunctionCallSite | null } {
  let flow = startMessageFunctionFlow({
    content: text,
    messageId,
    mk,
    initialStat: {},
    meta: {},
    formal,
  });
  let guard = 0;
  while (!flow.done && flow.pendingCall === null && guard < MAX_BLOCKS_PER_RUN) {
    flow = advanceMessageFunctionFlow(flow);
    guard += 1;
  }
  return { flow, pendingCall: flow.pendingCall };
}

/**
 * 本节点当前只服务正式同步路径，因此固定按正式模式驱动。
 *
 * 纯计算入口（快照、历史、试算）必须不执行作者函数；它们要走这条路径时，
 * 需要先把它声明为节点输入，而不是靠未登记的旁路参数。
 */
function inputFormal(): boolean {
  return true;
}

export function run(
  inputs: Readonly<{ "era.sync.context": Envelope<unknown> }>,
): any {
  const context = inputs["era.sync.context"].value as SyncContextV1;
  const work = planSyncWork(context);
  const floor = processingFloor(context);

  if (floor === null) {
    const empty = work as unknown as Readonly<Record<string, unknown>>;
    return {
      expression_command_result: empty,
      function_invocation_route: "none",
      pending_function_call: null,
      block_cursor: null,
      // 没有处理楼层时谈不上「未完成」：这里没有可续做的块。
      message_incomplete: false,
    };
  }

  const formal = inputFormal();
  const driven = driveBlocks(floor.text, floor.messageId, floor.mk, formal);
  const pending = driven.pendingCall;

  return {
    expression_command_result: work as unknown as Readonly<Record<string, unknown>>,
    function_invocation_route: pending === null ? "none" : "invoke",
    pending_function_call: pending,
    // 流程状态随结果报出：它自带块游标与累计状态，是跨步骤续做的依据。
    block_cursor: {
      messageId: floor.messageId,
      mk: floor.mk,
      blockIndex: driven.flow.cursor.blockIndex,
      done: driven.flow.done && pending === null,
    },
    // 调用尚未执行时，这条消息**没有**处理完：下游据此保留续做状态，
    // 不得按「已完成」走提交与收尾。
    message_incomplete: pending !== null,
    message_function_flow: driven.flow,
  };
}
