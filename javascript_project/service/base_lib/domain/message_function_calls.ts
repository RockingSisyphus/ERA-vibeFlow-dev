/**
 * ERA 消息内函数调用（<EraFCall/>）语法层：调用块解析、已处理判定、块序列与操作区渲染。
 *
 * 纯函数模块：不读取 Tavern、不写持久化、不读取时间或随机数、不在模块级保存可变状态。
 * 调用块自闭合且只允许与六类指令同级出现在顶层，因此本模块不依赖技术块配对器
 * （`parseEraTechnicalProjection` 只收严格配对的顶层块，自闭合标签会让它整体失效）。
 */

import {
  parsePositionedMessageCommands,
  type EraCommandParseInput,
  type EraCrudCommand,
  type EraCrudDiagnostic,
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
    }
  | {
      readonly kind: "call";
      readonly blockIndex: number;
      readonly start: number;
      readonly end: number;
      readonly call: EraFunctionCallSite;
      readonly insideOperationsRegion: boolean;
      readonly operationsRegionId: string | null;
    };

/** 命令类型到既有标签名的唯一映射，供渲染操作区与展示复用。 */
const COMMAND_TAG_BY_TYPE: Readonly<Record<string, string>> = Object.freeze({
  insert: "VariableInsert",
  edit: "VariableEdit",
  delete: "VariableDelete",
  "function-insert": "FunctionInsert",
  "function-edit": "FunctionEdit",
  "function-delete": "FunctionDelete",
});

const CALL_BLOCK_PATTERN = /<erafcall\b([^>]*?)\/?>/giu;
const OPERATIONS_REGION_PATTERN =
  /<erafcalltx\b([^>]*)>([\s\S]*?)<\/erafcalltx>/giu;
const COMMAND_BLOCK_PATTERN =
  /<((?:Variable|Function)(?:Insert|Edit|Delete))>\s*(?=[\s\S]*?\S[\s\S]*?<\/\1>)((?:(?!<(?:era_data|Variable(?:Think|Insert|Edit|Delete)|Function(?:Insert|Edit|Delete))>|<\/\1>)[\s\S])*?)\s*<\/\1>/giu;

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
}

/** 收集操作区；`for` 为空的操作区没有归属，直接忽略。 */
function collectOperationsRegions(content: string): readonly OperationsRegion[] {
  const regions: OperationsRegion[] = [];
  let match: RegExpExecArray | null;
  OPERATIONS_REGION_PATTERN.lastIndex = 0;
  while ((match = OPERATIONS_REGION_PATTERN.exec(content)) !== null) {
    const id = attributesOf(match[1] ?? "").get("for");
    if (id === undefined || id.length === 0) continue;
    regions.push({
      id,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return regions;
}

/** 六类指令块的字节范围，用于判定调用块是否被嵌套在指令块内部。 */
function collectCommandRanges(
  content: string,
): readonly { readonly start: number; readonly end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  COMMAND_BLOCK_PATTERN.lastIndex = 0;
  while ((match = COMMAND_BLOCK_PATTERN.exec(content)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
}

function insideRange(
  position: number,
  ranges: readonly { readonly start: number; readonly end: number }[],
): boolean {
  return ranges.some(range => position > range.start && position < range.end);
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
  const commandRanges = collectCommandRanges(content);
  const calls: EraFunctionCallSite[] = [];

  let match: RegExpExecArray | null;
  CALL_BLOCK_PATTERN.lastIndex = 0;
  while ((match = CALL_BLOCK_PATTERN.exec(content)) !== null) {
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
  operations: readonly EraCrudCommand[],
): string {
  const rendered: string[] = [];
  for (const operation of operations) {
    const tagName = COMMAND_TAG_BY_TYPE[operation.type];
    if (tagName === undefined) continue;
    for (const payload of operation.data) {
      rendered.push(`<${tagName}>${JSON.stringify(payload)}</${tagName}>`);
    }
  }
  const body = rendered.length > 0 ? `\n${rendered.join("\n")}\n` : "";
  return `<${ERA_FUNCTION_CALL_OPERATIONS_TAG} for="${callId}">${body}</${ERA_FUNCTION_CALL_OPERATIONS_TAG}>`;
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
