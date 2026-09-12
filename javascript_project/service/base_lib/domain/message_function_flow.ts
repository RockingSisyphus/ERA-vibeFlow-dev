/**
 * ERA 消息内函数调用的 Service 侧流程状态机（纯函数）。
 *
 * 职责边界：本模块按原文位置逐块推进一条消息、记录已完成与待执行的事实，并在
 * 宿主机回送函数结果后把产出写成调用块下方的操作区记录。它**不执行作者函数**——
 * 函数执行是宿主机能力（浏览器侧），因此这里只暴露「有待调用」并等待回送。
 *
 * 为什么必须是纯状态机：函数调用会把一条消息的处理推到下一个批次，块进度与文本
 * 必须能随步骤携带与恢复，而不能依赖内存中的会话对象。
 */

import {
  advanceEraBlockSession,
  createEraBlockCursor,
  parseEraFunctionCalls,
  parseMessageBlocks,
  renderEraFunctionCallOperationsRegion,
  startEraBlockSession,
  type EraBlockCursor,
  type EraFunctionCallSite,
} from "./message_function_calls.ts";
import {
  applyMessageCommands,
  type EraCrudDiagnostic,
} from "./crud_engine.ts";

export interface MessageFunctionFlowInput {
  readonly content: string;
  readonly messageId: number;
  readonly mk: string;
  readonly initialStat: unknown;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly initialStatFunc?: Readonly<Record<string, unknown>>;
  /** `@f()` 的快照闭包（消息起点函数库）；省略时退回 `initialStatFunc`。 */
  readonly messageStartStatFunc?: Readonly<Record<string, unknown>>;
  readonly traditionalToSimplified?: boolean;
  /** 正式同步为 true；只读与试算为 false。 */
  readonly formal?: boolean;
}

/** 宿主机回送的函数终态；字段与 Host 侧能力回执保持一致。 */
export interface MessageFunctionOutcome {
  readonly status: "completed" | "failed" | "cancelled";
  readonly name: string;
  readonly result: string | null;
  readonly message: string;
  readonly unregistered: boolean;
}

/**
 * 把一次函数调用写成「已处理」记录：给调用块打标记并紧随其后插入操作区。
 *
 * 为什么操作区不带 `applied`：函数产出从未被任何一侧就地写入已提交状态，唯一
 * 生效路径就是这份记录随消息一起重放。标成已应用会让重放跳过它，函数效果凭空
 * 消失；只有「宿主机确实就地应用过」的历史记录才允许带该标记。
 *
 * 已经带标记的调用原样返回：重复回送不得改写正文，否则同一条消息会写两次。
 */
export function recordEraFunctionCallOutcome(input: {
  readonly content: string;
  readonly callId: string;
  readonly outcome: MessageFunctionOutcome;
  readonly operations: readonly Readonly<Record<string, unknown>>[];
}): string {
  const call = parseEraFunctionCalls(input.content).find(
    item => item.callId === input.callId,
  );
  if (call === undefined || call.processed) return input.content;
  const region = renderEraFunctionCallOperationsRegion(
    input.callId,
    input.operations,
    { applied: false },
  );
  const failed = input.outcome.status !== "completed";
  const marker = failed ? ' status="done" error="ERA_FCALL_FAILED"' : ' status="done"';
  const original = input.content.slice(call.start, call.end);
  const marked = original.replace(/\/\s*>$/, `${marker}/>`);
  return (
    input.content.slice(0, call.start) +
    `${marked}\n${region}` +
    input.content.slice(call.end)
  );
}

export interface MessageFunctionFlow {
  readonly content: string;
  readonly messageId: number;
  readonly mk: string;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly stat: unknown;
  readonly statFunc: Readonly<Record<string, unknown>> | undefined;
  /**
   * `@f()` 看到的**消息起点函数闭包**。
   *
   * 与 `statFunc`（本条消息的当前函数库）分开保存：逐块执行时每个块都会刷新 `statFunc`，
   * 若快照跟着走，块 1 的 `FunctionEdit` 就会改掉块 2 的 `@f()` 语义（真机 EXPR-FUNC-006）。
   */
  readonly messageStartStatFunc: Readonly<Record<string, unknown>> | undefined;
  readonly cursor: EraBlockCursor;
  readonly done: boolean;
  /** 需要宿主机执行的函数；为 null 表示没有待调用。 */
  readonly pendingCall: EraFunctionCallSite | null;
  readonly executedBlockIndexes: readonly number[];
  readonly diagnostics: readonly EraCrudDiagnostic[];
  /** 已确认未注册的工具名，供作者诊断提示。 */
  readonly unregisteredCalls: readonly string[];
  readonly cancelled: boolean;
  /** 正式同步为 true；只读与试算为 false，此时不产生待调用。 */
  readonly formal: boolean;
  readonly traditionalToSimplified: boolean;
}

/** 从一个楼层的起点建立流程状态。 */
export function startMessageFunctionFlow(input: MessageFunctionFlowInput): MessageFunctionFlow {
  return {
    content: input.content,
    messageId: input.messageId,
    mk: input.mk,
    meta: input.meta,
    stat: input.initialStat,
    statFunc: input.initialStatFunc,
    messageStartStatFunc: input.messageStartStatFunc ?? input.initialStatFunc,
    cursor: createEraBlockCursor({ messageId: input.messageId, mk: input.mk }),
    done: false,
    pendingCall: null,
    executedBlockIndexes: [],
    diagnostics: [],
    unregisteredCalls: [],
    cancelled: false,
    formal: input.formal ?? true,
    traditionalToSimplified: input.traditionalToSimplified ?? false,
  };
}

/**
 * 推进一个块。
 *
 * 每次推进都用当前文本重建会话并带上游标，因此函数写回的操作区会成为后续步骤的
 * 输入；遇到无标记调用时只记录待调用并停止，不在这里执行任何作者代码。
 */
export function advanceMessageFunctionFlow(
  flow: MessageFunctionFlow,
): MessageFunctionFlow {
  if (flow.cancelled || flow.done) {
    return { ...flow, executedBlockIndexes: [], diagnostics: [] };
  }
  const advanced = advanceEraBlockSession(
    startEraBlockSession({
      content: flow.content,
      messageId: flow.messageId,
      mk: flow.mk,
      initialStat: flow.stat,
      ...(flow.statFunc === undefined ? {} : { initialStatFunc: flow.statFunc }),
      ...(flow.messageStartStatFunc === undefined
        ? {}
        : { messageStartStatFunc: flow.messageStartStatFunc }),
      meta: flow.meta,
      randomSourceKey: flow.mk,
      formal: flow.formal,
      traditionalToSimplified: flow.traditionalToSimplified,
      cursor: flow.cursor,
    }),
  );
  return {
    ...flow,
    stat: advanced.stat,
    statFunc: advanced.statFunc ?? flow.statFunc,
    cursor: advanced.cursor,
    pendingCall: advanced.pendingCall,
    done: advanced.done && advanced.pendingCall === null,
    executedBlockIndexes: advanced.executedBlockIndexes,
    // 诊断必须跨步累计，否则后续步骤会覆盖掉早先的未执行或嵌套提示。
    diagnostics: [...flow.diagnostics, ...advanced.diagnostics],
  };
}

/** 宿主机回送：函数终态与它在函数期间已就地应用的操作。 */
export interface MessageFunctionResume {
  readonly outcome: MessageFunctionOutcome;
  readonly operations: readonly Readonly<Record<string, unknown>>[];
}

/**
 * 回送一次函数结果，并把产出写成调用块下方的操作区记录。
 *
 * 操作区随文本一起重放，因此这里**不**再把操作预先并入累计状态：文本推进会
 * 按原文位置执行操作区里的操作块，那才是它们唯一一次生效。预先并入会让同一次
 * 变化在累计状态里生效两次。
 */
export function resumeMessageFunctionFlow(
  flow: MessageFunctionFlow,
  resume: MessageFunctionResume,
): MessageFunctionFlow {
  if (flow.cancelled) return flow;
  const call = flow.pendingCall;
  if (call === null || call.callId === null) return flow;

  const content = recordEraFunctionCallOutcome({
    content: flow.content,
    callId: call.callId,
    outcome: resume.outcome,
    operations: resume.operations,
  });

  const unregisteredCalls =
    resume.outcome.unregistered && !flow.unregisteredCalls.includes(resume.outcome.name)
      ? [...flow.unregisteredCalls, resume.outcome.name]
      : flow.unregisteredCalls;

  return {
    ...flow,
    content,
    pendingCall: null,
    // 调用块已写入 status：下一次推进会跳过它并把操作区当作普通操作块执行。
    unregisteredCalls,
    diagnostics: [...flow.diagnostics],
    executedBlockIndexes: [],
  };
}

/** 只读事实：当前文本里仍未被处理的调用清单，供诊断与只读入口使用。 */
export function unprocessedCallsOf(flow: MessageFunctionFlow): readonly EraFunctionCallSite[] {
  return parseMessageBlocks({ content: flow.content }).flatMap(block =>
    block.kind === "call" && !block.call.processed ? [block.call] : [],
  );
}

/** 只读事实：把一条函数产出的操作应用到给定状态，供调用方核对而不改动流程。 */
export function applyFunctionOperations(input: {
  readonly content: string;
  readonly messageId: number;
  readonly mk: string;
  readonly stat: unknown;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly operations: readonly Readonly<Record<string, unknown>>[];
}): { readonly stat: unknown } {
  let stat = input.stat;
  for (const operation of input.operations) {
    const kind = "edit" in operation ? "edit" : "insert" in operation ? "insert" : "delete";
    const tag =
      kind === "edit" ? "VariableEdit" : kind === "insert" ? "VariableInsert" : "VariableDelete";
    const applied = applyMessageCommands({
      content: `<${tag}>${JSON.stringify(operation[kind])}</${tag}>`,
      messageId: input.messageId,
      initialStat: stat,
      meta: input.meta,
      randomSourceKey: input.mk,
      commandRange: { fromIndex: 0, toIndex: 1 },
    });
    stat = applied.finalStat;
  }
  return { stat };
}


/**
 * 跨批次携带的最小游标。
 *
 * 只保留恢复所必需且体积可控的字段：正文、元数据与累计变量都可由宿主重新读取
 * 或随步骤携带，放进服务状态会让它随业务数据无限膨胀。
 */
export interface MessageFunctionFlowCursor {
  readonly messageId: number;
  readonly mk: string;
  readonly blockIndex: number;
  readonly done: boolean;
}

/** 从流程状态提取可持久化游标。 */
export function cursorFromMessageFunctionFlow(
  flow: MessageFunctionFlow,
): MessageFunctionFlowCursor {
  return {
    messageId: flow.messageId,
    mk: flow.mk,
    blockIndex: flow.cursor.blockIndex,
    done: flow.done,
  };
}

/**
 * 用持久化游标与重新读取的上下文恢复流程状态。
 *
 * 楼层身份必须一致：MK 或 messageId 变化说明恢复点已经指向另一条消息，
 * 此时沿用旧位置会把操作写到错误的楼层，因此直接抛类型化错误而不静默降级。
 */
export function rehydrateMessageFunctionFlow(input: {
  readonly cursor: MessageFunctionFlowCursor;
  readonly content: string;
  readonly messageId: number;
  readonly mk: string;
  readonly initialStat: unknown;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly initialStatFunc?: Readonly<Record<string, unknown>>;
  /** `@f()` 的快照闭包（消息起点函数库）；省略时退回 `initialStatFunc`。 */
  readonly messageStartStatFunc?: Readonly<Record<string, unknown>>;
  readonly traditionalToSimplified?: boolean;
  readonly formal?: boolean;
}): MessageFunctionFlow {
  if (input.cursor.messageId !== input.messageId || input.cursor.mk !== input.mk) {
    throw new TypeError(
      `ERA_SYNC_CURSOR_IDENTITY: 恢复游标属于 messageId=${input.cursor.messageId} mk=${input.cursor.mk}，` +
        `与当前楼层 messageId=${input.messageId} mk=${input.mk} 不一致。`,
    );
  }
  const started = startMessageFunctionFlow({
    content: input.content,
    messageId: input.messageId,
    mk: input.mk,
    initialStat: input.initialStat,
    meta: input.meta,
    ...(input.initialStatFunc === undefined ? {} : { initialStatFunc: input.initialStatFunc }),
    ...(input.messageStartStatFunc === undefined
      ? {}
      : { messageStartStatFunc: input.messageStartStatFunc }),
    ...(input.traditionalToSimplified === undefined
      ? {}
      : { traditionalToSimplified: input.traditionalToSimplified }),
    ...(input.formal === undefined ? {} : { formal: input.formal }),
  });
  return {
    ...started,
    cursor: { ...started.cursor, blockIndex: input.cursor.blockIndex, done: input.cursor.done },
    done: input.cursor.done,
  };
}
