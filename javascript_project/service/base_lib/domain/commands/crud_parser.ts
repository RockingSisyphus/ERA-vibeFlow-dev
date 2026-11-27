/**
 * ERA VariableInsert / VariableEdit / VariableDelete 纯计算引擎。
 *
 * 输入必须是 JSON 可移植的消息内容、状态与元数据；模块不读取 Tavern、不写持久化、
 * 不读取时间或随机数，也不在模块级保存 Converter、RegExp 或可变业务状态。
 */

import { readCommandBlocks, type EraCrudCommand, type EraCrudDiagnostic } from "../../../../../base_lib/command_payload/command_payload.ts";
export type { EraCrudCommand, EraCrudCommandType, EraCrudDiagnostic, EraCrudDiagnosticCode } from "../../../../../base_lib/command_payload/command_payload.ts";
import { Converter } from "opencc-js";
import { cloneEraPortableJsonV1 } from "@era/vibeflow-contracts";


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

function convertTraditionalToSimplified(source: string): string {
  const converter = Converter({ from: "tw", to: "cn" });
  return converter(source);
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
  return readCommandBlocks(
    input.content,
    input.traditionalToSimplified ? convertTraditionalToSimplified : undefined,
  ).map((command) => ({
    ...command,
    data: prepareCommandData(command),
  }));
}

export function prepareCommandData(command: EraCrudCommand): readonly unknown[] {
  return cloneCrudValue(
    command.type.startsWith("function-") ? command.data : escapeVariableCommandData(command.data),
  );
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
