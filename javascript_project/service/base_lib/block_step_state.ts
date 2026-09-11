/**
 * 块步进状态的共享形状与事实提取。
 *
 * prepare、advance、finalize 三个节点必须对「块步进状态」与「处理楼层身份」给出完全
 * 一致的解释；把形状与提取逻辑放在这里，避免三处各自解释而漂移。
 */

import type { EraFunctionCallSite } from "./domain/message_function_calls.ts";
import type { MessageFunctionFlow } from "./domain/message_function_flow.ts";
import type {
  SyncContextV1,
  EraMessageFunctionHandoffV1,
} from "./sync_contracts.ts";
import type { SyncWorkV1 } from "./sync_contracts.ts";

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
  /**
   * 楼层原文与元数据随状态携带。
   *
   * 循环 body 拿不到父作用域的能力输入（实测报 required workflow input 'sync_context' is missing），
   * 因此 body 需要的一切都必须由携带状态本身提供：否则只能放弃循环体只吃状态的约束。
   */
  readonly content: string;
  readonly meta: Readonly<Record<string, unknown>>;
  /**
   * 预规划的同步工作项随状态携带。
   *
   * 收口节点不能再消费一次同步上下文，也不能「消费并再次提供」同一类型（线性消费会让它永不被调度），
   * 因此工作项必须随块步进状态一起走，收口节点只依赖状态这一个输入。
   */
  readonly work: Readonly<Record<string, unknown>>;
}

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 从派发上下文取出当前处理楼层的消息身份与文本；不可用时返回 null。 */
export function processingFloor(
  context: SyncContextV1,
): {
  readonly messageId: number;
  readonly mk: string;
  readonly text: string;
} | null {
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

/** 已提交侧车状态中的变量、函数库与元数据；位置状态必须从这里出发。 */
export function committedWorld(context: SyncContextV1): {
  readonly stat: Readonly<Record<string, unknown>>;
  readonly statFunc: Readonly<Record<string, unknown>>;
  readonly meta: Readonly<Record<string, unknown>>;
} {
  const raw = record(context.variablesRaw) ? context.variablesRaw : {};
  const stat = record(raw.stat_data)
    ? raw.stat_data
    : record(raw.stat)
      ? raw.stat
      : {};
  const statFunc = record(raw.statFunc) ? raw.statFunc : {};
  const meta = record(raw.ERAMetaData)
    ? raw.ERAMetaData
    : record(raw.meta)
      ? raw.meta
      : {};
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

/**
 * 把「一个块之后的状态」收口成可提交工作项。
 *
 * 锁定语义要求每个操作块执行完就提交一次状态。既有提交链的 stat/statFunc/meta 全部取自
 * plan，因此单块提交不需要新的提交通道：为这一块构造一个只含该块的 plan，再交给既有的
 * `buildSyncCommitRequest` + `era.tavern.variables_commit` 写入即可。
 *
 * 为什么 messageUpdates 必须带锚定后的文本：记录要落在该块的位置（切片 1a 的
 * `anchoredTransactionContent` 负责锚定），否则重放顺序会变成「先后续块、后本块」，
 * 对非交换操作会算出与实时不同的终值。
 */
export function buildBlockCommitWork(input: {
  readonly work: SyncWorkV1;
  readonly state: EraBlockStepStateV1;
  readonly content: string;
  readonly messageIndex: number;
}): SyncWorkV1 {
  const count = input.state.blockIndex > 0 ? input.state.blockIndex : 1;
  const plan = {
    kind: "sync",
    status: "fast-sync",
    committed: true,
    divergence: null,
    stat: input.state.stat,
    statFunc: input.state.statFunc,
    meta: input.work.plan === null ? {} : input.work.plan.meta,
    messages: input.work.plan === null ? [] : input.work.plan.messages,
    messageUpdates: [
      {
        kind: "update-message-content",
        messageId: input.state.messageId,
        messageIndex: input.messageIndex,
        mk: input.state.mk,
        content: { kind: "text", text: input.content },
      },
    ],
    sealedCompactionCandidates: [],
    recalculatedMessageIndexes: [],
    rollback: { applied: false, fromMk: null, toMk: null },
    actionsTaken: {
      rollback: false,
      apply: true,
      resync: false,
      api: false,
      editedResync: false,
      swipedRollback: false,
    },
    consecutiveProcessingCount: count,
    nextConsecutiveState: { mk: input.state.mk, count },
    diagnostics: [],
  } as unknown as SyncWorkV1["plan"];
  return {
    ...input.work,
    disposition: "commit",
    plan,
    payload:
      input.work.payload === null
        ? null
        : {
            ...input.work.payload,
            mk: input.state.mk,
            message_id: input.state.messageId,
            actions: plan.actionsTaken,
          },
  };
}
