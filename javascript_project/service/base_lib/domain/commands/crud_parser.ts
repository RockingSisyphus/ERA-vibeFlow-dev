/**
 * ERA VariableInsert / VariableEdit / VariableDelete 纯计算引擎。
 *
 * 输入必须是 JSON 可移植的消息内容、状态与元数据；模块不读取 Tavern、不写持久化、
 * 不读取时间或随机数，也不在模块级保存 Converter、RegExp 或可变业务状态。
 */

import { Converter } from "opencc-js";
import { cloneEraPortableJsonV1 } from "@era/vibeflow-contracts";


export type EraCrudCommandType =
  | "insert"
  | "edit"
  | "delete"
  | "function-insert"
  | "function-edit"
  | "function-delete";

export interface EraCrudCommand {
  readonly type: EraCrudCommandType;
  readonly data: readonly unknown[];
}

export type EraCrudEditLog =
  | {
      readonly op: "insert";
      readonly path: string;
      readonly value_new: unknown;
    }
  | {
      readonly op: "update";
      readonly path: string;
      readonly value_old: unknown;
      readonly value_new: unknown;
    }
  | {
      readonly op: "delete";
      readonly path: string;
      readonly value_old: unknown;
    };

export type EraFunctionEditLog =
  | {
      readonly op: "insert";
      readonly name: string;
      readonly value_new: unknown;
    }
  | {
      readonly op: "update";
      readonly name: string;
      readonly value_old: unknown;
      readonly value_new: unknown;
    }
  | {
      readonly op: "delete";
      readonly name: string;
      readonly value_old: unknown;
    };

export interface EraCrudResult {
  readonly finalStat: unknown;
  readonly editLog: readonly EraCrudEditLog[];
  readonly finalStatFunc?: Readonly<Record<string, unknown>>;
  readonly functionEditLog?: readonly EraFunctionEditLog[];
}

export type EraCrudDiagnosticCode = string;

export interface EraCrudDiagnostic {
  readonly code: EraCrudDiagnosticCode;
  readonly message: string;
  readonly path: string;
}

export interface EraCommandParseInput {
  readonly content: string;
  readonly traditionalToSimplified?: boolean;
}

export interface EraEditContext {
  readonly messageId: number;
  readonly meta: Readonly<Record<string, unknown>>;
  /** Immutable message-layer baseline used by @path expressions. */
  readonly layerStartStat?: unknown;
  /** Current and message-start function libraries supplied by Sidecar replay. */
  readonly statFunc?: Readonly<Record<string, unknown>>;
  readonly layerStartStatFunc?: Readonly<Record<string, unknown>>;
  /**
   * Ephemeral per-message cursor.  It is created from the message MK by the Service and is
   * deliberately shared by every `$expr` leaf in source/JSON order.  It is never persisted.
   */
  readonly randomCursor?: {
    readonly sourceKey: string;
    drawOffset: number;
  };
}

export interface EraApplyMessageCommandsInput {
  readonly content: string;
  readonly messageId: number;
  readonly initialStat: unknown;
  readonly meta: Readonly<Record<string, unknown>>;
  /** Current Sidecar function library. It is never read from chat variables. */
  readonly initialStatFunc?: Readonly<Record<string, unknown>>;
  /** `@f()` 的快照闭包（消息起点函数库）；省略时退回 `initialStatFunc`。 */
  readonly messageStartStat?: unknown;
  readonly messageStartStatFunc?: Readonly<Record<string, unknown>>;
  /** Stable message MK used as the default deterministic-random seed. */
  readonly randomSourceKey?: string;
  readonly traditionalToSimplified?: boolean;
  /**
   * 逐块推进一步一块的生命周期：只执行 [fromIndex, toIndex) 内的块。
   * 省略时保持既有语义，一次执行整条消息的全部六类指令。
   */
  readonly commandRange?: Readonly<{
    readonly fromIndex: number;
    readonly toIndex: number;
  }>;
  /**
   * 本次重放从第几次抽取开始。
   *
   * 被中断的逐块提交楼层恢复时，重放只执行「剩下」的指令，但抽取序列必须接着已提交块继续：
   * 否则同一份原文在「整楼重放」与「续做」两条路径上会抽到不同的随机值，终值不再等价。
   * 省略时保持既有语义（从 0 开始）。
   */
  readonly randomDrawOffset?: number;
}

export interface EraApplyMessageCommandsResult extends EraCrudResult {
  readonly commands: readonly EraCrudCommand[];
  readonly diagnostics: readonly EraCrudDiagnostic[];
  /** Present when `randomSourceKey` was supplied; remains an in-memory replay result only. */
  readonly randomDrawsConsumed?: number;
  readonly nextRandomDrawOffset?: number;
}

interface PositionedCommand extends EraCrudCommand {
  readonly index: number;
}

export interface TemplateContext {
  readonly inheritedContent: unknown;
  readonly parentData: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function defineOwn(
  target: Record<string, unknown> | unknown[],
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

/** 深拷贝 JSON 值，同时保留数组中的空洞与 null 位置。 */
export function cloneCrudValue<T>(value: T): T {
  return cloneEraPortableJsonV1(value) as T;
}

function escapeString(value: string): string {
  return value
    .replace(/\./g, "__DOT__")
    .replace(/"/g, "__DQUOTE__")
    .replace(/'/g, "__SQUOTE__");
}

/** 递归转义 ERA 内部路径会误解的键和值。 */
export function escapeEraData<T>(value: T): T {
  if (Array.isArray(value)) {
    const result = new Array<unknown>(value.length);
    for (let index = 0; index < value.length; index += 1) {
      if (index in value) result[index] = escapeEraData(value[index]);
    }
    return result as T;
  }
  if (isPlainRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      defineOwn(result, escapeString(key), escapeEraData(value[key]));
    }
    return result as T;
  }
  return (typeof value === "string" ? escapeString(value) : value) as T;
}

/**
 * `$expr` is source text consumed by the expression root, rather than a Tavern path or a
 * user value.  Preserve it byte-for-byte while applying the established escape policy to
 * all ordinary Variable payload fields.
 */
function escapeVariableCommandData<T>(value: T): T {
  if (Array.isArray(value)) {
    const result = new Array<unknown>(value.length);
    for (let index = 0; index < value.length; index += 1) {
      if (index in value)
        result[index] = escapeVariableCommandData(value[index]);
    }
    return result as T;
  }
  if (isPlainRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      const item = value[key];
      defineOwn(
        result,
        escapeString(key),
        key === "$expr" && typeof item === "string"
          ? item
          : escapeVariableCommandData(item),
      );
    }
    return result as T;
  }
  return (typeof value === "string" ? escapeString(value) : value) as T;
}

/**
 * 保持候选实现的数组净化规则：数组中的对象或数组转成 JSON 字符串，null 保留；
 * 普通对象则继续递归处理其属性。
 */
export function sanitizeArrays(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      Array.isArray(item) || isPlainRecord(item) ? JSON.stringify(item) : item,
    );
  }
  if (isPlainRecord(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      defineOwn(result, key, sanitizeArrays(value[key]));
    }
    return result;
  }
  return value;
}

function mergeValues(base: unknown, patch: unknown): unknown {
  if (Array.isArray(base) || Array.isArray(patch)) {
    return cloneCrudValue(patch);
  }
  if (isPlainRecord(base) && isPlainRecord(patch)) {
    const result = cloneCrudValue(base);
    for (const key of Object.keys(patch)) {
      const next = Object.prototype.hasOwnProperty.call(result, key)
        ? mergeValues(result[key], patch[key])
        : cloneCrudValue(patch[key]);
      defineOwn(result, key, next);
    }
    return result;
  }
  if (isPlainRecord(patch)) return cloneCrudValue(patch);
  if (typeof patch === "undefined" || patch === null) {
    return cloneCrudValue(base);
  }
  return cloneCrudValue(patch);
}

/** 深合并对象，并在任一侧为数组时用补丁数组整体覆盖。 */
export function mergeReplaceArray(base: unknown, patch: unknown): unknown {
  const initial = isPlainRecord(base) ? cloneCrudValue(base) : {};
  if (!isPlainRecord(patch)) return initial;
  return mergeValues(initial, patch);
}

function stripComments(source: string): string {
  if (!source) return "";
  let result = "";
  let inString = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' && (index === 0 || source[index - 1] !== "\\")) {
      inString = !inString;
    }
    if (inString) {
      result += character;
      continue;
    }
    const next = source[index + 1];
    if (character === "/" && next === "/") {
      const end = source.indexOf("\n", index + 2);
      if (end === -1) break;
      result += "\n";
      index = end;
      continue;
    }
    if (character === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      if (end === -1) break;
      index = end + 1;
      continue;
    }
    if (character === "<" && source.substring(index, index + 4) === "<!--") {
      const end = source.indexOf("-->", index + 4);
      if (end === -1) break;
      index = end + 2;
      continue;
    }
    result += character;
  }
  return result;
}

/** 解析候选实现接受的串联 JSON 对象，并忽略字符串字面量外的注释。 */
export function parseJsonl(source: string): unknown[] {
  const objects: unknown[] = [];
  if (!source || typeof source !== "string") return objects;
  const content = stripComments(source).trim();
  let braceCount = 0;
  let startIndex = -1;
  let inString = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"' && (index === 0 || content[index - 1] !== "\\")) {
      inString = !inString;
    }
    if (inString) continue;
    if (character === "{") {
      if (braceCount === 0) startIndex = index;
      braceCount += 1;
    } else if (character === "}" && braceCount > 0) {
      braceCount -= 1;
      if (braceCount === 0 && startIndex !== -1) {
        try {
          objects.push(JSON.parse(content.substring(startIndex, index + 1)));
        } catch {
          // 候选实现跳过当前损坏片段并继续寻找后续对象。
        }
        startIndex = -1;
      }
    }
  }
  return objects;
}

function stripCodeFence(source: string): string {
  if (!source) return source;
  let result = String(source).trim();
  result = result.replace(/^\s*(?:```|~~~)[a-zA-Z0-9_-]*\s*\r?\n/, "");
  result = result.replace(/\r?\n(?:```|~~~)\s*$/, "");
  return result.trim();
}

function convertTraditionalToSimplified(source: string): string {
  const converter = Converter({ from: "tw", to: "cn" });
  return converter(source);
}

function parseBlockContent(source: string): unknown[] {
  let parsed = parseJsonl(source);
  if (parsed.length > 0) return parsed;
  try {
    const single: unknown = JSON.parse(source);
    parsed = Array.isArray(single) ? single : [single];
  } catch {
    return [];
  }
  return parsed;
}

/** 从混合消息中按原始出现位置提取六类 ERA 指令，并保留每个块的原文字节范围。
 *
 * 变量 payload 沿用既有路径转义；函数定义是表达式 root 的输入，不能经过路径
 * 转义，否则函数名、参数或表达式中的 `.` 会被改写。
 *
 * 逐块推进的生命周期需要把指令块与调用块合并为同一份位置有序块列表，
 * 因此位置与范围在这里一次算出，调用方不再自行重建匹配位置。
 */
export function parsePositionedMessageCommands(
  input: EraCommandParseInput,
): readonly (EraCrudCommand & {
  readonly start: number;
  readonly end: number;
})[] {
  if (!input || typeof input.content !== "string" || !input.content) return [];
  const commands: (PositionedCommand & { readonly end: number })[] = [];
  const commandPattern =
    /<((?:Variable|Function)(?:Insert|Edit|Delete))>\s*(?=[\s\S]*?\S[\s\S]*?<\/\1>)((?:(?!<(?:era_data|Variable(?:Think|Insert|Edit|Delete)|Function(?:Insert|Edit|Delete))>|<\/\1>)[\s\S])*?)\s*<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = commandPattern.exec(input.content)) !== null) {
    const cleaned = stripCodeFence((match[2] ?? "").trim());
    if (!cleaned) continue;
    const parseSource = input.traditionalToSimplified
      ? convertTraditionalToSimplified(cleaned)
      : cleaned;
    const parsed = parseBlockContent(parseSource);
    if (parsed.length === 0) continue;
    const tagName = (match[1] ?? "").toLowerCase();
    let type: EraCrudCommandType;
    if (tagName === "variableinsert") type = "insert";
    else if (tagName === "variableedit") type = "edit";
    else if (tagName === "variabledelete") type = "delete";
    else if (tagName === "functioninsert") type = "function-insert";
    else if (tagName === "functionedit") type = "function-edit";
    else if (tagName === "functiondelete") type = "function-delete";
    else continue;
    commands.push({
      type,
      data: type.startsWith("function-")
        ? cloneCrudValue(parsed)
        : escapeVariableCommandData(parsed),
      index: match.index,
      end: match.index + match[0].length,
    });
  }
  commands.sort((left, right) => left.index - right.index);
  return commands.map((command) => ({
    type: command.type,
    data: cloneCrudValue(command.data),
    start: command.index,
    end: command.end,
  }));
}

/** 从混合消息中按原始出现位置提取六类 ERA 指令。
 *
 * 变量 payload 沿用既有路径转义；函数定义是表达式 root 的输入，不能经过路径
 * 转义，否则函数名、参数或表达式中的 `.` 会被改写。
 */
export function parseMessageCommands(
  input: EraCommandParseInput,
): EraCrudCommand[] {
  return parsePositionedMessageCommands(input).map((command) => ({
    type: command.type,
    data: cloneCrudValue(command.data),
  }));
}
