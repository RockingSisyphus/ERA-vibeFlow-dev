/**
 * 块步进状态的共享形状与事实提取。
 *
 * prepare、advance、finalize 三个节点必须对「块步进状态」与「处理楼层身份」给出完全
 * 一致的解释；把形状与提取逻辑放在这里，避免三处各自解释而漂移。
 */

import type { EraFunctionCallSite } from "./domain/message_function_calls.ts";
import type { MessageFunctionFlow } from "./domain/message_function_flow.ts";
import type { SyncContextV1, EraMessageFunctionHandoffV1 } from "./sync_contracts.ts";

/** 块步进承载状态；与 `era.sync.block.step.state`/`.next` 两个 schema 同形。 */
export interface EraBlockStepStateV1 {
  readonly messageId: number;
  readonly mk: string;
  readonly blockIndex: number;
  readonly done: boolean;
  readonly stat: Readonly<Record<string, unknown>>;
  readonly statFunc: Readonly<Record<string, unknown>>;
  readonly route: "none" | "invoke";
  readonly handoff: EraMessageFunctionHandoffV1 | null;
}

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 从派发上下文取出当前处理楼层的消息身份与文本；不可用时返回 null。 */
export function processingFloor(
  context: SyncContextV1,
): { readonly messageId: number; readonly mk: string; readonly text: string } | null {
  const step = context.step;
  const dispatch = record(step) ? step.dispatchContext : null;
  if (!record(dispatch)) return null;
  const message = record(dispatch.processingMessage) ? dispatch.processingMessage : null;
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

/** 已提交侧车状态中的变量、函数库与元数据；位置状态必须从这里出发。 */
export function committedWorld(context: SyncContextV1): {
  readonly stat: Readonly<Record<string, unknown>>;
  readonly statFunc: Readonly<Record<string, unknown>>;
  readonly meta: Readonly<Record<string, unknown>>;
} {
  const raw = record(context.variablesRaw) ? context.variablesRaw : {};
  const stat = record(raw.stat_data) ? raw.stat_data : record(raw.stat) ? raw.stat : {};
  const statFunc = record(raw.statFunc) ? raw.statFunc : {};
  const meta = record(raw.ERAMetaData) ? raw.ERAMetaData : record(raw.meta) ? raw.meta : {};
  return { stat, statFunc, meta };
}

/** 交接事实：函数读取位置状态与调用参数的全部依据。 */
export function handoffOf(input: {
  readonly floor: { readonly messageId: number; readonly mk: string };
  readonly call: EraFunctionCallSite;
  readonly blockIndex: number;
  readonly flow: MessageFunctionFlow;
}): EraMessageFunctionHandoffV1 {
  return {
    schemaVersion: 1,
    messageId: input.floor.messageId,
    mk: input.floor.mk,
    blockIndex: input.blockIndex,
    callId: input.call.callId ?? "",
    name: input.call.name ?? "",
    args: input.call.args ?? {},
    stat: record(input.flow.stat) ? input.flow.stat : {},
    statFunc: input.flow.statFunc ?? {},
  };
}
