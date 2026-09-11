/**
 * 一步一块：驱动一条消息的块序列，并在块边界把函数调用交给宿主。
 *
 * 遇到无标记 `<EraFCall/>` 时**无条件断开**：本批次不提交任何状态，只把调用位置
 * （楼层、块下标、调用标识、参数、该位置的累计状态）随工作项交给 Host。函数由
 * Host 在步骤之外执行，产出的操作随后以 `era.message.invoke_continue` 恢复事件
 * 回送，届时整条消息按原文位置一次性重放并提交。
 *
 * 为什么本批次必须不提交：函数效果的唯一生效路径是它自己的操作区记录，而这份
 * 记录只有在函数返回之后才存在。先提交一次「还没有函数效果的半条消息」，会让
 * 侧车状态与消息文本对不上，也会让恢复后的重放把前段块的效果算两次。
 *
 * 工作项仍由登记的 sync_planning 纯函数产出，因此与既有提交链完全兼容。
 */

import {
  advanceMessageFunctionFlow,
  startMessageFunctionFlow,
  type MessageFunctionFlow,
} from "../../base_lib/domain/message_function_flow.ts";
import type { EraFunctionCallSite } from "../../base_lib/domain/message_function_calls.ts";
import { planSyncWork } from "../../base_lib/sync_planning.ts";
import type {
  SyncContextV1,
  SyncWorkV1,
  EraMessageFunctionHandoffV1,
} from "../../base_lib/sync_contracts.ts";

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
 * 取出该楼层起点已提交的变量与函数状态。
 *
 * 函数要读的是自己所在位置的状态，因此位置状态必须从「这条消息之前已提交的
 * 侧车状态」出发，再叠加本条消息调用之前的块；从空对象出发会让函数读到空世界。
 */
function committedState(context: SyncContextV1): {
  readonly stat: unknown;
  readonly statFunc: Readonly<Record<string, unknown>>;
  readonly meta: Readonly<Record<string, unknown>>;
} {
  const raw = record(context.variablesRaw) ? context.variablesRaw : {};
  const stat = raw.stat_data ?? raw.stat ?? {};
  const statFunc = record(raw.statFunc) ? raw.statFunc : {};
  const meta = record(raw.ERAMetaData)
    ? raw.ERAMetaData
    : record(raw.meta)
      ? raw.meta
      : {};
  return { stat, statFunc, meta };
}

/**
 * 按块推进一条消息，直到没有待调用或到达末尾。
 *
 * 每次推进只处理一个块；遇到未处理调用立即停止，函数由宿主机在块边界之外执行。
 */
function driveBlocks(input: {
  readonly text: string;
  readonly messageId: number;
  readonly mk: string;
  readonly formal: boolean;
  readonly stat: unknown;
  readonly statFunc: Readonly<Record<string, unknown>>;
  readonly meta: Readonly<Record<string, unknown>>;
}): { readonly flow: MessageFunctionFlow; readonly pendingCall: EraFunctionCallSite | null } {
  let flow = startMessageFunctionFlow({
    content: input.text,
    messageId: input.messageId,
    mk: input.mk,
    initialStat: input.stat,
    initialStatFunc: input.statFunc,
    meta: input.meta,
    formal: input.formal,
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

/** 有条文可执行、但缺调用标识的调用无法被回送匹配：按待处理报出。 */
function handoffOf(input: {
  readonly floor: { readonly messageId: number; readonly mk: string };
  readonly call: EraFunctionCallSite;
  readonly blockIndex: number;
  readonly stat: unknown;
  readonly statFunc: Readonly<Record<string, unknown>>;
}): EraMessageFunctionHandoffV1 {
  return {
    schemaVersion: 1,
    messageId: input.floor.messageId,
    mk: input.floor.mk,
    blockIndex: input.blockIndex,
    callId: input.call.callId ?? "",
    name: input.call.name ?? "",
    args: input.call.args ?? {},
    stat: record(input.stat) ? input.stat : {},
    statFunc: input.statFunc,
  };
}

/** 交接工作项：保留既有工作项身份，但声明为不提交并附带交接事实。 */
function deferredWork(work: SyncWorkV1, handoff: EraMessageFunctionHandoffV1): SyncWorkV1 {
  return {
    ...work,
    disposition: "no-op",
    plan: null,
    payload: null,
    failure: null,
    handoff,
  };
}

export function run(
  inputs: Readonly<{ "era.sync.context": Envelope<unknown> }>,
): any {
  const context = inputs["era.sync.context"].value as SyncContextV1;
  const work = planSyncWork(context);
  const floor = processingFloor(context);

  if (floor === null) {
    return {
      expression_command_result: work as unknown as Readonly<Record<string, unknown>>,
      function_invocation_route: "none",
      pending_function_call: null,
      block_cursor: null,
      // 没有处理楼层时谈不上「未完成」：这里没有可续做的块。
      message_incomplete: false,
      function_handoff: null,
    };
  }

  // 读取或规划已经失败时不做交接：把失败如实交给既有失败分支处理。
  if (work.disposition === "failed") {
    return {
      expression_command_result: work as unknown as Readonly<Record<string, unknown>>,
      function_invocation_route: "none",
      pending_function_call: null,
      block_cursor: null,
      message_incomplete: false,
      function_handoff: null,
    };
  }

  const base = committedState(context);
  const driven = driveBlocks({
    text: floor.text,
    messageId: floor.messageId,
    mk: floor.mk,
    formal: inputFormal(),
    stat: base.stat,
    statFunc: base.statFunc,
    meta: base.meta,
  });
  const pending = driven.pendingCall;
  const cursor = {
    messageId: floor.messageId,
    mk: floor.mk,
    blockIndex: driven.flow.cursor.blockIndex,
    done: driven.flow.done && pending === null,
  };

  if (pending === null || pending.name === null) {
    return {
      expression_command_result: work as unknown as Readonly<Record<string, unknown>>,
      function_invocation_route: "none",
      pending_function_call: null,
      block_cursor: cursor,
      message_incomplete: false,
      function_handoff: null,
    };
  }

  const handoff = handoffOf({
    floor,
    call: pending,
    blockIndex: cursor.blockIndex,
    stat: driven.flow.stat,
    statFunc: driven.flow.statFunc ?? base.statFunc,
  });
  return {
    expression_command_result: deferredWork(work, handoff) as unknown as Readonly<
      Record<string, unknown>
    >,
    function_invocation_route: "invoke",
    pending_function_call: pending,
    block_cursor: cursor,
    // 调用尚未执行时，这条消息**没有**处理完：既不能提交，也不能标记连续处理。
    message_incomplete: true,
    function_handoff: handoff,
  };
}
