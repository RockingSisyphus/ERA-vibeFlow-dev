/**
 * ERA 消息内函数调用（<EraFCall/>）语法层：调用块解析、已处理判定、块序列与操作区渲染。
 *
 * 纯函数模块：不读取 Tavern、不写持久化、不读取时间或随机数、不在模块级保存可变状态。
 * 调用块自闭合且只允许与六类指令同级出现在顶层，因此本模块不依赖技术块配对器
 * （`parseEraTechnicalProjection` 只收严格配对的顶层块，自闭合标签会让它整体失效）。
 */

import {
  applyMessageCommands,
  parsePositionedMessageCommands,
  type EraCommandParseInput,
  type EraCrudCommand,
  type EraCrudDiagnostic,
  type EraCrudEditLog,
  type EraFunctionEditLog,
} from "./crud_engine.ts";

/** 规范写法首字母大写；解析大小写不敏感。 */
export const ERA_FUNCTION_CALL_TAG = "EraFCall";
export const ERA_FUNCTION_CALL_OPERATIONS_TAG = "EraFCallTx";

/** 技术块名单需要的小写形式（解析器统一转小写比较）。 */
export const ERA_FUNCTION_CALL_TAG_LOWER = "erafcall";
export const ERA_FUNCTION_CALL_OPERATIONS_TAG_LOWER = "erafcalltx";

/** 调用块的已处理标记属性值与诊断码。 */
export const ERA_FUNCTION_CALL_DONE_ATTRIBUTE = "done";

export const ERA_FCALL_NAME_REQUIRED = "ERA_FCALL_NAME_REQUIRED";
export const ERA_FCALL_ARGS_INVALID = "ERA_FCALL_ARGS_INVALID";
export const ERA_FCALL_NESTED = "ERA_FCALL_NESTED";

/** 一处调用块在原文中的解析结果；`name` 或 `args` 为 null 表示该属性不可用。 */
export interface EraFunctionCallSite {
  readonly callId: string | null;
  readonly name: string | null;
  readonly args: Readonly<Record<string, unknown>> | null;
  /** `status="done"` 或下方紧邻操作区存在时为真。 */
  readonly processed: boolean;
  /** 嵌在某个六类指令块内部：只报诊断、不执行。 */
  readonly nested: boolean;
  /** 命中该调用的操作区 `for` 值；无匹配操作区时为 null。 */
  readonly operationsRegionId: string | null;
  /** 错误诊断码，不参与已处理判定。 */
  readonly error: string | null;
  readonly start: number;
  readonly end: number;
  readonly diagnostics: readonly EraCrudDiagnostic[];
}

/** 六类指令块与调用块合并后的同权位置有序块。 */
export type EraMessageBlock =
  | {
      readonly kind: "command";
      readonly blockIndex: number;
      readonly start: number;
      readonly end: number;
      readonly command: EraCrudCommand;
      readonly insideOperationsRegion: boolean;
      readonly operationsRegionId: string | null;
      readonly operationsRegionApplied: boolean;
    }
  | {
      readonly kind: "call";
      readonly blockIndex: number;
      readonly start: number;
      readonly end: number;
      readonly call: EraFunctionCallSite;
      readonly insideOperationsRegion: boolean;
      readonly operationsRegionId: string | null;
      readonly operationsRegionApplied: boolean;
    };

/** 函数产出操作的 kind → 既有标签名，渲染操作区时使用。 */
const OPERATION_TAG_BY_KIND: Readonly<Record<string, string>> = Object.freeze({
  edit: "VariableEdit",
  insert: "VariableInsert",
  delete: "VariableDelete",
});


/** 六类指令块的字节范围，用于判定调用块是否被嵌套在指令块内部。 */
function commandBlockRanges(
  input: EraCommandParseInput,
): readonly { readonly start: number; readonly end: number }[] {
  return parsePositionedMessageCommands(input).map(command => ({
    start: command.start,
    end: command.end,
  }));
}

function insideRange(
  position: number,
  ranges: readonly { readonly start: number; readonly end: number }[],
): boolean {
  return ranges.some(range => position > range.start && position < range.end);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 解析标签属性：同时接受双引号与单引号，忽略前导空白。 */
function attributesOf(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern = /([A-Za-z_][\w.-]*)\s*=\s*("([^"]*)"|'([^']*)')/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const key = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? "";
    attributes.set(key, value);
  }
  return attributes;
}

interface OperationsRegion {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  /** 该区域的操作已在函数运行期间就地应用，重放时必须跳过，否则同一变化生效两次。 */
  readonly applied: boolean;
}

/** 收集操作区；`for` 为空的操作区没有归属，直接忽略。 */
function collectOperationsRegions(content: string): readonly OperationsRegion[] {
  const regions: OperationsRegion[] = [];
  // 在函数内新建：模块级 g 标志正则会在调用之间保留 lastIndex。
  const pattern = /<erafcalltx\b([^>]*)>([\s\S]*?)<\/erafcalltx>/giu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const attributes = attributesOf(match[1] ?? "");
    const id = attributes.get("for");
    if (id === undefined || id.length === 0) continue;
    regions.push({
      id,
      start: match.index,
      end: match.index + match[0].length,
      applied: attributes.get("applied") === "1",
    });
  }
  return regions;
}

/** 调用块下方紧邻的操作区：允许其间只有空白。 */
function adjacentOperationsRegion(
  call: { readonly end: number; readonly callId: string | null },
  content: string,
  regions: readonly OperationsRegion[],
): OperationsRegion | null {
  if (call.callId === null) return null;
  for (const region of regions) {
    if (region.id !== call.callId) continue;
    if (region.start < call.end) continue;
    if (content.slice(call.end, region.start).trim().length > 0) continue;
    return region;
  }
  return null;
}

function diagnostic(code: string, message: string): EraCrudDiagnostic {
  return { code, message, path: "" };
}

/**
 * 解析消息中全部调用块。属性缺失或非法时仍返回该调用块并附诊断，
 * 以便调用方按「报告错误、写已处理标记、继续后续操作」处理，而不是静默丢弃。
 */
export function parseEraFunctionCalls(content: string): readonly EraFunctionCallSite[] {
  if (typeof content !== "string" || content.length === 0) return [];

  const regions = collectOperationsRegions(content);
  const commandRanges = commandBlockRanges({ content });
  const calls: EraFunctionCallSite[] = [];

  // 同上：每次调用新建正则，避免 lastIndex 泄漏到下一次工作流调用。
  const callPattern = /<erafcall\b([^>]*?)\/?>/giu;
  let match: RegExpExecArray | null;
  while ((match = callPattern.exec(content)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const attributes = attributesOf(match[1] ?? "");
    const diagnostics: EraCrudDiagnostic[] = [];

    const rawName = attributes.get("name");
    const name =
      rawName !== undefined && rawName.trim().length > 0 ? rawName.trim() : null;
    if (name === null)
      diagnostics.push(
        diagnostic(ERA_FCALL_NAME_REQUIRED, "EraFCall 缺少非空 name 属性。"),
      );

    const rawArgs = attributes.get("args");
    let args: Record<string, unknown> | null = {};
    if (rawArgs !== undefined && rawArgs.trim().length > 0) {
      try {
        const parsed: unknown = JSON.parse(rawArgs);
        if (isRecord(parsed)) args = parsed;
        else {
          args = null;
          diagnostics.push(
            diagnostic(
              ERA_FCALL_ARGS_INVALID,
              "EraFCall args 必须是 JSON 对象。",
            ),
          );
        }
      } catch {
        args = null;
        diagnostics.push(
          diagnostic(ERA_FCALL_ARGS_INVALID, "EraFCall args 不是合法 JSON。"),
        );
      }
    }

    const callId = attributes.get("id") ?? null;
    const status = (attributes.get("status") ?? "").trim().toLowerCase();
    const nested = insideRange(start, commandRanges);
    if (nested)
      diagnostics.push(
        diagnostic(
          ERA_FCALL_NESTED,
          "EraFCall 不允许嵌在 ERA 指令块内部，只允许顶层同级出现。",
        ),
      );

    const region = adjacentOperationsRegion({ end, callId }, content, regions);
    const error = attributes.get("error") ?? null;

    calls.push({
      callId,
      name,
      args,
      processed: status === ERA_FUNCTION_CALL_DONE_ATTRIBUTE || region !== null,
      nested,
      operationsRegionId: region?.id ?? null,
      error,
      start,
      end,
      diagnostics,
    });
  }

  return calls;
}

/** 已处理判定：status 标记或操作区存在，二者任一成立。 */
export function isEraFunctionCallProcessed(call: EraFunctionCallSite): boolean {
  return call.processed;
}

/** 未处理清单：排除嵌套调用与已处理调用；顺序即原文顺序。 */
export function findUnprocessedEraFunctionCalls(
  calls: readonly EraFunctionCallSite[],
): readonly EraFunctionCallSite[] {
  return calls.filter(call => !call.nested && !call.processed);
}

interface CommandBlockRange {
  readonly start: number;
  readonly end: number;
  readonly command: EraCrudCommand;
}

/** 复用既有解析器的块字节范围，保证块序列与重放语义完全一致。 */
function parseCommandBlocks(input: EraCommandParseInput): readonly CommandBlockRange[] {
  return parsePositionedMessageCommands(input)
    .filter(
      command =>
        command.type === "insert" ||
        command.type === "edit" ||
        command.type === "delete" ||
        command.type === "function-insert" ||
        command.type === "function-edit" ||
        command.type === "function-delete",
    )
    .map(command => ({
      start: command.start,
      end: command.end,
      command: { type: command.type, data: command.data },
    }));
}

function regionOf(
  position: number,
  regions: readonly OperationsRegion[],
): OperationsRegion | null {
  for (const region of regions) {
    if (position > region.start && position < region.end) return region;
  }
  return null;
}

/**
 * 把六类指令块与调用块合并为同一份按原文位置有序的块列表。
 * 操作区内部的操作块与原文操作块同权：同样出现在列表中，只是带归属信息。
 */
export function parseMessageBlocks(input: EraCommandParseInput): readonly EraMessageBlock[] {
  const content = input?.content ?? "";
  if (typeof content !== "string" || content.length === 0) return [];

  const regions = collectOperationsRegions(content);
  const calls = parseEraFunctionCalls(content);
  const commands = parseCommandBlocks(input);

  const blocks: EraMessageBlock[] = [];
  for (const command of commands) {
    const region = regionOf(command.start, regions);
    blocks.push({
      kind: "command",
      blockIndex: -1,
      start: command.start,
      end: command.end,
      command: command.command,
      insideOperationsRegion: region !== null,
      operationsRegionId: region?.id ?? null,
      operationsRegionApplied: region?.applied ?? false,
    });
  }
  for (const call of calls) {
    const region = regionOf(call.start, regions);
    blocks.push({
      kind: "call",
      blockIndex: -1,
      start: call.start,
      end: call.end,
      call,
      insideOperationsRegion: region !== null,
      operationsRegionId: region?.id ?? null,
      operationsRegionApplied: region?.applied ?? false,
    });
  }

  blocks.sort((left, right) => left.start - right.start || left.end - right.end);
  return blocks.map((block, index) => ({ ...block, blockIndex: index }));
}

/**
 * 渲染一处调用产出的操作区。作者提交的含义原样保留：`$expr` 保存表达式、
 * 固定值保存固定值；空操作也写空操作区，作为「已处理」的证据。
 */
export function renderEraFunctionCallOperationsRegion(
  callId: string,
  operations: readonly Readonly<Record<string, unknown>>[],
  options: Readonly<{ readonly applied?: boolean }> = {},
): string {
  const rendered: string[] = [];
  for (const operation of operations) {
    for (const [kind, tagName] of Object.entries(OPERATION_TAG_BY_KIND)) {
      if (!Object.prototype.hasOwnProperty.call(operation, kind)) continue;
      rendered.push(
        `<${tagName}>${JSON.stringify(operation[kind])}</${tagName}>`,
      );
    }
  }
  const body = rendered.length > 0 ? `\n${rendered.join("\n")}\n` : "";
  const applied = options.applied === true ? ' applied="1"' : "";
  return `<${ERA_FUNCTION_CALL_OPERATIONS_TAG} for="${callId}"${applied}>${body}</${ERA_FUNCTION_CALL_OPERATIONS_TAG}>`;
}

/** 调用块的可读描述，供诊断与只读展示复用。 */
export function describeEraFunctionCallBlock(call: EraFunctionCallSite): string {
  const anchor = call.callId === null ? "" : ` id=${call.callId}`;
  const diagnosticCodes = call.diagnostics.map(item => item.code);
  const suffix =
    diagnosticCodes.length > 0 ? ` [${diagnosticCodes.join(",")}]` : "";
  const state = call.processed ? "已处理" : "待处理";
  return `EraFCall{name=${call.name ?? "?"}${anchor} ${state}}${suffix}`;
}

/** 纯计算模式跳过无标记调用时使用的诊断码。 */
export const ERA_FCALL_NOT_EXECUTED = "ERA_FCALL_NOT_EXECUTED";
/** 已处理调用重放其操作区时使用的提示码。 */
export const ERA_FCALL_REPLAYED = "ERA_FCALL_REPLAYED";
/** 推进上限保护：超过该块数仍未结束时报诊断而不是静默截断。 */
export const ERA_BLOCK_CURSOR_LIMIT = "ERA_BLOCK_CURSOR_LIMIT";

/**
 * 一步一块的块游标。只保存续做所需的最小状态：当前楼层与块下标、本楼已记日志
 * 增量与当前随机抽取偏移；不保存累计变量（由调用方随步骤携带）。
 */
export interface EraBlockCursor {
  readonly messageId: number;
  readonly mk: string;
  readonly blockIndex: number;
  readonly done: boolean;
  readonly randomDrawOffset: number;
  readonly editLog: readonly EraCrudEditLog[];
  readonly functionEditLog: readonly EraFunctionEditLog[];
}

export interface EraBlockAdvanceInput {
  readonly content: string;
  readonly messageId: number;
  readonly cursor: EraBlockCursor;
  readonly initialStat: unknown;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly initialStatFunc?: Readonly<Record<string, unknown>>;
  readonly randomSourceKey?: string;
  readonly traditionalToSimplified?: boolean;
  /** 正式同步为 true（可要求调用函数）；只读与试算为 false。 */
  readonly formal?: boolean;
}

export interface EraBlockAdvanceResult {
  /** 本次推进实际执行的块下标；最多一个。 */
  readonly executedBlockIndexes: readonly number[];
  readonly cursor: EraBlockCursor;
  readonly finalStat: unknown;
  readonly finalStatFunc?: Readonly<Record<string, unknown>>;
  /** 本块要求调用的函数；没有待调用时为 null。 */
  readonly pendingCall: EraFunctionCallSite | null;
  readonly diagnostics: readonly EraCrudDiagnostic[];
}

/** 从楼层起点创建游标：不携带上次推进的任何累计状态。 */
export function createEraBlockCursor(input: {
  readonly messageId: number;
  readonly mk: string;
}): EraBlockCursor {
  return {
    messageId: input.messageId,
    mk: input.mk,
    blockIndex: 0,
    done: false,
    randomDrawOffset: 0,
    editLog: [],
    functionEditLog: [],
  };
}

function blockDiagnostic(code: string, message: string): EraCrudDiagnostic {
  return { code, message, path: "" };
}

/**
 * 推进一个块：读到一块 → 执行一块 → 推进一步，然后结束。
 *
 * 调用块本身不产生变量操作；未处理调用会以 pendingCall 交回调用方，
 * 由调用方在块边界之外执行函数并把结果写回操作区。嵌套调用块只报诊断。
 */
export function advanceEraBlockCursor(
  input: EraBlockAdvanceInput,
): EraBlockAdvanceResult {
  const formal = input.formal ?? true;
  const blocks = parseMessageBlocks({
    content: input.content,
    traditionalToSimplified: input.traditionalToSimplified,
  });
  const index = input.cursor.blockIndex;
  const diagnostics: EraCrudDiagnostic[] = [];

  if (index >= blocks.length) {
    return {
      executedBlockIndexes: [],
      cursor: { ...input.cursor, done: true },
      finalStat: input.initialStat,
      ...(input.initialStatFunc === undefined
        ? {}
        : { finalStatFunc: input.initialStatFunc }),
      pendingCall: null,
      diagnostics,
    };
  }

  const block = blocks[index];
  const nextCursorBase = {
    ...input.cursor,
    blockIndex: index + 1,
  };

  if (block.kind === "call") {
    const call = block.call;
    diagnostics.push(...call.diagnostics);
    const requiresCall = !call.nested && !call.processed;
    if (requiresCall && !formal) {
      diagnostics.push(
        blockDiagnostic(
          ERA_FCALL_NOT_EXECUTED,
          `只读或试算入口不执行 EraFCall ${call.name ?? "?"}；其操作区已有的操作仍按普通块重放。`,
        ),
      );
      return {
        executedBlockIndexes: [],
        cursor: { ...nextCursorBase, done: nextCursorBase.blockIndex >= blocks.length },
        finalStat: input.initialStat,
        ...(input.initialStatFunc === undefined
          ? {}
          : { finalStatFunc: input.initialStatFunc }),
        pendingCall: null,
        diagnostics,
      };
    }
    if (requiresCall) {
      // 游标停在调用块：写成已处理后重入自然跳过它并继续操作区，
      // 也避免「末尾是调用块」时被误判为本消息已完成。
      return {
        executedBlockIndexes: [],
        cursor: { ...input.cursor, done: false },
        finalStat: input.initialStat,
        ...(input.initialStatFunc === undefined
          ? {}
          : { finalStatFunc: input.initialStatFunc }),
        pendingCall: call,
        diagnostics,
      };
    }
    return {
      executedBlockIndexes: [],
      cursor: { ...nextCursorBase, done: nextCursorBase.blockIndex >= blocks.length },
      finalStat: input.initialStat,
      ...(input.initialStatFunc === undefined
        ? {}
        : { finalStatFunc: input.initialStatFunc }),
      pendingCall: null,
      diagnostics,
    };
  }

  // 已应用区域内的指令块跳过：这些操作在函数运行期间已就地生效。
  if (block.kind === "command" && block.operationsRegionApplied) {
    return {
      executedBlockIndexes: [],
      cursor: { ...nextCursorBase, done: nextCursorBase.blockIndex >= blocks.length },
      finalStat: input.initialStat,
      ...(input.initialStatFunc === undefined
        ? {}
        : { finalStatFunc: input.initialStatFunc }),
      pendingCall: null,
      diagnostics,
    };
  }

  // 指令块：块下标与「指令序号」不是同一个数——调用块不进入指令列表，
  // 因此这里按块序列数出前面有多少个指令块，得到本块在指令列表中的位置。
  const commandOrdinal = blocks
    .slice(0, index)
    .filter(item => item.kind === "command").length;
  const applied = applyMessageCommands({
    content: input.content,
    messageId: input.messageId,
    initialStat: input.initialStat,
    initialStatFunc: input.initialStatFunc,
    meta: input.meta,
    randomSourceKey: input.randomSourceKey,
    traditionalToSimplified: input.traditionalToSimplified,
    commandRange: {
      fromIndex: commandOrdinal,
      toIndex: commandOrdinal + 1,
    },
  });
  diagnostics.push(...applied.diagnostics);

  return {
    executedBlockIndexes: applied.commands.length > 0 ? [index] : [],
    cursor: {
      ...nextCursorBase,
      done: nextCursorBase.blockIndex >= blocks.length,
      randomDrawOffset: applied.nextRandomDrawOffset ?? input.cursor.randomDrawOffset,
      editLog: [...input.cursor.editLog, ...applied.editLog],
      functionEditLog: [
        ...input.cursor.functionEditLog,
        ...(applied.functionEditLog ?? []),
      ],
    },
    finalStat: applied.finalStat,
    ...(applied.finalStatFunc === undefined
      ? {}
      : { finalStatFunc: applied.finalStatFunc }),
    pendingCall: null,
    diagnostics,
  };
}

/** 一次可续做的「一步一块」消息重放会话。 */
export interface EraBlockSession {
  readonly content: string;
  readonly messageId: number;
  readonly cursor: EraBlockCursor;
  /** 消息内全部块是否已处理完成。 */
  readonly done: boolean;
  /** 调用方需要执行的函数；为 null 表示没有待调用。 */
  readonly pendingCall: EraFunctionCallSite | null;
  /**
   * 调用方已处理、但消息文本尚未写回（或写回的是过期内容）的调用标识集合。
   * 本会话按标识、而不是按布尔标记或块位置跳过这些调用，避免反复要求同一个调用，
   * 也避免误跳过后续新出现的调用。
   */
  readonly resolvedCallIds: readonly string[];
  readonly meta: Readonly<Record<string, unknown>>;
  readonly formal: boolean;
  readonly traditionalToSimplified: boolean;
  readonly stat: unknown;
  readonly statFunc: Readonly<Record<string, unknown>> | undefined;
  /** 最近一次推进实际执行的块下标；最多一个。 */
  readonly executedBlockIndexes: readonly number[];
  /** 本楼累计的变量编辑日志增量，供提交边界一次取出。 */
  readonly editLog: readonly EraCrudEditLog[];
  /** 本楼累计的函数编辑日志增量。 */
  readonly functionEditLog: readonly EraFunctionEditLog[];
  readonly diagnostics: readonly EraCrudDiagnostic[];
}

export interface EraBlockSessionInput {
  readonly content: string;
  readonly messageId: number;
  readonly mk: string;
  readonly initialStat: unknown;
  readonly meta: Readonly<Record<string, unknown>>;
  readonly initialStatFunc?: Readonly<Record<string, unknown>>;
  readonly randomSourceKey?: string;
  readonly traditionalToSimplified?: boolean;
  /** 正式同步为 true；只读与试算为 false。 */
  readonly formal?: boolean;
  /** 跨步骤续做时传入既有游标；省略时从楼层起点开始。 */
  readonly cursor?: EraBlockCursor;
  readonly pendingCall?: EraFunctionCallSite | null;
  /** 已处理但文本尚未写回的调用标识；跨步骤续做时原样带回来。 */
  readonly resolvedCallIds?: readonly string[];
}

/**
 * 建立一个消息重放会话。会话只保存续做所需的最小状态；累计变量与函数库
 * 由会话自身携带，块游标负责块位置与日志增量。
 */
export function startEraBlockSession(
  input: EraBlockSessionInput,
): EraBlockSession {
  const cursor =
    input.cursor ??
    createEraBlockCursor({ messageId: input.messageId, mk: input.mk });
  return {
    content: input.content,
    messageId: input.messageId,
    cursor,
    done: cursor.done,
    pendingCall: input.pendingCall ?? null,
    resolvedCallIds: input.resolvedCallIds ?? [],
    meta: input.meta,
    formal: input.formal ?? true,
    traditionalToSimplified: input.traditionalToSimplified ?? false,
    stat: input.initialStat,
    statFunc: input.initialStatFunc,
    executedBlockIndexes: [],
    editLog: cursor.editLog,
    functionEditLog: cursor.functionEditLog,
    diagnostics: [],
  };
}

/**
 * 推进一个块并返回新会话。
 *
 * 已经停在待调用上时：
 * - 未传 `resolvePendingCall`：原样返回，等待调用方完成函数；
 * - 传了 `resolvePendingCall`：清除待调用并继续推进（调用方已把该调用写为已处理）。
 */
export function advanceEraBlockSession(
  session: EraBlockSession,
  input: Readonly<{
    readonly resolvePendingCall?: boolean;
  }> = {},
): EraBlockSession {
  if (session.pendingCall !== null) {
    if (input.resolvePendingCall !== true) return session;
    const resolvedId = session.pendingCall.callId;
    return {
      ...session,
      pendingCall: null,
      resolvedCallIds:
        resolvedId === null
          ? session.resolvedCallIds
          : session.resolvedCallIds.includes(resolvedId)
            ? session.resolvedCallIds
            : [...session.resolvedCallIds, resolvedId],
    };
  }
  if (session.done) {
    // 已经完成：返回清空了「本次执行」痕迹的会话，不能把上一步的结果再报一次。
    return {
      ...session,
      pendingCall: null,
      executedBlockIndexes: [],
      diagnostics: [],
    };
  }

  const step = (cursor: EraBlockCursor) =>
    advanceEraBlockCursor({
      content: session.content,
      messageId: session.messageId,
      cursor,
      initialStat: session.stat,
      meta: session.meta,
      ...(session.statFunc === undefined
        ? {}
        : { initialStatFunc: session.statFunc }),
      randomSourceKey: cursor.mk,
      formal: session.formal,
      traditionalToSimplified: session.traditionalToSimplified,
    });

  let advanced = step(session.cursor);

  // 撞到的调用是「调用方已处理、文本尚未写回」的那个时，按标识越过它继续，
  // 不把它再次交回调用方。
  const pendingId = advanced.pendingCall?.callId ?? null;
  if (
    advanced.pendingCall !== null &&
    pendingId !== null &&
    session.resolvedCallIds.includes(pendingId)
  ) {
    advanced = step({
      ...session.cursor,
      blockIndex: session.cursor.blockIndex + 1,
      done: false,
    });
  }

  const nextPendingId = advanced.pendingCall?.callId ?? null;
  const resolvedCallIds =
    nextPendingId === null
      ? session.resolvedCallIds
      : session.resolvedCallIds.includes(nextPendingId)
        ? session.resolvedCallIds
        : [...session.resolvedCallIds, nextPendingId];

  return {
    ...session,
    cursor: advanced.cursor,
    done: advanced.cursor.done,
    pendingCall: advanced.pendingCall,
    resolvedCallIds,
    stat: advanced.finalStat,
    statFunc: advanced.finalStatFunc ?? session.statFunc,
    executedBlockIndexes: advanced.executedBlockIndexes,
    editLog: advanced.cursor.editLog,
    functionEditLog: advanced.cursor.functionEditLog,
    diagnostics: advanced.diagnostics,
  };
}
