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
  findUnprocessedEraFunctionCalls,
  parseMessageBlocks,
  startEraBlockSession,
  advanceEraBlockSession,
  type EraBlockSession,
  type EraFunctionCallSite,
} from "../../base_lib/domain/message_function_calls.ts";
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
 * 按块推进一条消息，返回会话与需要执行的首个未处理调用。
 *
 * 每次推进只处理一个块；不需要调用时继续推进，遇到未处理调用立即停止，
 * 由调用方在块边界之外执行函数。上限保护避免异常输入造成无界循环。
 */
function driveBlocks(
  text: string,
  messageId: number,
  mk: string,
): {
  readonly session: EraBlockSession;
  readonly pendingCall: EraFunctionCallSite | null;
  readonly steps: number;
} {
  let session = startEraBlockSession({
    content: text,
    messageId,
    mk,
    initialStat: {},
    meta: {},
    formal: true,
  });
  let steps = 0;
  while (!session.done && session.pendingCall === null && steps < MAX_BLOCKS_PER_RUN) {
    session = advanceEraBlockSession(session);
    steps += 1;
  }
  return { session, pendingCall: session.pendingCall, steps };
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
    };
  }

  const driven = driveBlocks(floor.text, floor.messageId, floor.mk);
  // 会话在 pendingCall 处停止时，pendingCall 即待调用；未停止时再按已处理清单核对。
  const pending =
    driven.pendingCall ??
    findUnprocessedEraFunctionCalls(
      parseMessageBlocks({ content: floor.text }).flatMap(block =>
        block.kind === "call" ? [block.call] : [],
      ),
    )[0] ??
    null;

  return {
    expression_command_result: work as unknown as Readonly<Record<string, unknown>>,
    function_invocation_route: pending === null ? "none" : "invoke",
    pending_function_call: pending,
    block_cursor: {
      messageId: floor.messageId,
      mk: floor.mk,
      blockIndex: driven.session.cursor.blockIndex,
      done: driven.session.done && pending === null,
      steps: driven.steps,
    },
  };
}
