/**
 * ERA 消息内函数调用（<EraFCall/>）语法层：调用块解析、done 判定、块序列与历史记录读取。
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

/**
 * 逐块提交的「已应用」记录标签。
 *
 * 它包住已经提交进 sidecar 的块，是**计算期间**的进度凭据：楼层算完后由收尾提交删除，
 * 因此正常情况下消息里不会留下它；只要它还在，就说明这条楼层是被中断的，必须先把剩下的
 * 块算完再删。用独立标签而不是复用 `<era_tx>`：`<era_tx s="m">` 是公共 API 的「记录即应用」
 * 事务，还有同 scope 去重语义，两者混用会让 facade 提交被误判为已经写过。
 */
export const ERA_APPLIED_BLOCK_TAG = "era_block";

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
  /** 仅 `status="done"` 为真。 */
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

/** 六类指令块的字节范围，用于判定调用块是否被嵌套在指令块内部。 */
function commandBlockRanges(
  input: EraCommandParseInput,
): readonly { readonly start: number; readonly end: number }[] {
  return parsePositionedMessageCommands(input).map((command) => ({
    start: command.start,
    end: command.end,
  }));
}

function insideRange(
  position: number,
  ranges: readonly { readonly start: number; readonly end: number }[],
): boolean {
  return ranges.some((range) => position > range.start && position < range.end);
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
  /** 仅临时 era_block 记录为 true；旧 EraFCallTx 中的普通操作正常处理。 */
  readonly applied: boolean;
}

/**
 * 收集两种「操作区」：
 *
 * 1. 调用操作区 `<EraFCallTx for="c1">`：按 `for` 归属到调用块；`for` 为空时没有归属，忽略。
 * 2. **逐块提交的已应用记录** `<era_block applied="1">…</era_block>`：包住「已经提交进
 *    sidecar 的那一块」。楼层完成后删除；恢复时先依据累计日志撤销旧效果，再解包并重算。
 */
function collectOperationsRegions(
  content: string,
): readonly OperationsRegion[] {
  const regions: OperationsRegion[] = [];
  // 在函数内新建：模块级 g 标志正则会在调用之间保留 lastIndex。
  const callPattern = /<erafcalltx\b([^>]*)>([\s\S]*?)<\/erafcalltx>/giu;
  let match: RegExpExecArray | null;
  while ((match = callPattern.exec(content)) !== null) {
    const attributes = attributesOf(match[1] ?? "");
    const id = attributes.get("for");
    if (id === undefined || id.length === 0) continue;
    regions.push({
      id,
      start: match.index,
      end: match.index + match[0].length,
      applied: false,
    });
  }
  const blockPattern = new RegExp(
    `<${ERA_APPLIED_BLOCK_TAG}\\b([^>]*)>([\\s\\S]*?)<\\/${ERA_APPLIED_BLOCK_TAG}>`,
    "giu",
  );
  while ((match = blockPattern.exec(content)) !== null) {
    const attributes = attributesOf(match[1] ?? "");
    // 只有显式 applied="1" 的记录才表示「该块已经提交」；没有它就是一个惰性容器。
    if (attributes.get("applied") !== "1") continue;
    regions.push({
      id: "",
      start: match.index,
      end: match.index + match[0].length,
      applied: true,
    });
  }
  return regions.sort((left, right) => left.start - right.start);
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
export function parseEraFunctionCalls(
  content: string,
): readonly EraFunctionCallSite[] {
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
      rawName !== undefined && rawName.trim().length > 0
        ? rawName.trim()
        : null;
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
      processed: status === ERA_FUNCTION_CALL_DONE_ATTRIBUTE,
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

/** 已处理判定只来自 status="done"；旧操作区不参与判定。 */
export function isEraFunctionCallProcessed(call: EraFunctionCallSite): boolean {
  return call.processed;
}

/** 未处理清单：排除嵌套调用与已处理调用；顺序即原文顺序。 */
export function findUnprocessedEraFunctionCalls(
  calls: readonly EraFunctionCallSite[],
): readonly EraFunctionCallSite[] {
  return calls.filter((call) => !call.nested && !call.processed);
}

interface CommandBlockRange {
  readonly start: number;
  readonly end: number;
  readonly command: EraCrudCommand;
}

/** 复用既有解析器的块字节范围，保证块序列与重放语义完全一致。 */
function parseCommandBlocks(
  input: EraCommandParseInput,
): readonly CommandBlockRange[] {
  return parsePositionedMessageCommands(input)
    .filter(
      (command) =>
        command.type === "insert" ||
        command.type === "edit" ||
        command.type === "delete" ||
        command.type === "function-insert" ||
        command.type === "function-edit" ||
        command.type === "function-delete",
    )
    .map((command) => ({
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
export function parseMessageBlocks(
  input: EraCommandParseInput,
): readonly EraMessageBlock[] {
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

  blocks.sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  return blocks.map((block, index) => ({ ...block, blockIndex: index }));
}

/**
 * 把一个块包成「已应用」记录：`<era_block mk="…" applied="1">块原文</era_block>`。
 *
 * 包住（而不是在旁边另写一条）是为了让跳过判定与块位置解耦：块在记录内部，重放时按
 * 「块落在已应用区域内」跳过，周围文字怎么改都不会让记录指向错误的块。
 */
export function wrapBlockAsAppliedRecord(input: {
  readonly content: string;
  readonly start: number;
  readonly end: number;
  readonly mk: string;
  /**
   * 该块执行完时的随机抽取偏移（含）。续做时要从这里接着抽，否则同一份原文在
   * 「整楼重放」与「续做」两条路径上会抽到不同的随机值，终值不再等价。
   */
  readonly draws?: number;
}): string {
  const block = input.content.slice(input.start, input.end);
  const draws =
    Number.isSafeInteger(input.draws) && Number(input.draws) > 0
      ? ` draws="${Number(input.draws)}"`
      : "";
  const record = `<${ERA_APPLIED_BLOCK_TAG} mk="${input.mk}" applied="1"${draws}>${block}</${ERA_APPLIED_BLOCK_TAG}>`;
  return (
    input.content.slice(0, input.start) +
    record +
    input.content.slice(input.end)
  );
}

/**
 * 楼层里最靠后的已应用记录声明的抽取偏移。
 *
 * 逐块提交按原文顺序推进，因此最后一条记录就是最新的进度：它的 `draws` 是续做起点。
 * 没有任何记录（或记录未声明偏移）时返回 0，即既有语义「从头开始抽」。
 */
export function appliedRecordDrawOffset(content: string): number {
  const pattern = new RegExp(
    `<${ERA_APPLIED_BLOCK_TAG}\\b[^>]*\\bdraws\\s*=\\s*"?(\\d+)"?[^>]*>`,
    "giu",
  );
  let offset = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const value = Number(match[1]);
    if (Number.isSafeInteger(value) && value > offset) offset = value;
  }
  return offset;
}

/**
 * 删除全部「已应用」记录标签，保留其中的原文块。
 *
 * 楼层算完时的收尾：凭据只在计算期间存在，算完即删。删掉之后这条楼层的原文与「从楼层起点
 * 重算」完全一致，因此封存压缩永远不会遇到它。
 */
export function unwrapAppliedRecords(content: string): string {
  let result = content;
  for (;;) {
    const next = result.replace(
      new RegExp(
        `<${ERA_APPLIED_BLOCK_TAG}\\b[^>]*>([\\s\\S]*?)<\\/${ERA_APPLIED_BLOCK_TAG}>`,
        "iu",
      ),
      "$1",
    );
    if (next === result) return result;
    result = next;
  }
}

/** 楼层是否还留着「已应用」记录：留着就说明这条楼层是被中断的，必须先算完再删。 */
export function hasAppliedBlockRecords(content: string): boolean {
  return collectOperationsRegions(content).some((region) => region.applied);
}

/**
 * 开头连续多少个指令块已经带「已应用」记录。
 *
 * 逐块提交是**按原文顺序**推进的，因此已应用的块必然构成指令序列的前缀：重放从第
 * `appliedCommandPrefix` 个指令开始，就已提交的块不会被算第二遍。返回值直接就是既有
 * `applyMessageCommands` 的 `commandRange.fromIndex` 口径。
 */
export function appliedCommandPrefix(input: EraCommandParseInput): number {
  const content = input?.content ?? "";
  if (typeof content !== "string" || content.length === 0) return 0;
  const regions = collectOperationsRegions(content);
  let count = 0;
  for (const command of parseCommandBlocks(input)) {
    const region = regionOf(command.start, regions);
    if (region === null || !region.applied) break;
    count += 1;
  }
  return count;
}

/** 调用块的可读描述，供诊断与只读展示复用。 */
export function describeEraFunctionCallBlock(
  call: EraFunctionCallSite,
): string {
  const anchor = call.callId === null ? "" : ` id=${call.callId}`;
  const diagnosticCodes = call.diagnostics.map((item) => item.code);
  const suffix =
    diagnosticCodes.length > 0 ? ` [${diagnosticCodes.join(",")}]` : "";
  const state = call.processed ? "已处理" : "待处理";
  return `EraFCall{name=${call.name ?? "?"}${anchor} ${state}}${suffix}`;
}
