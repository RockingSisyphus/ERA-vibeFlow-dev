/**
 * ERA VariableInsert / VariableEdit / VariableDelete 纯计算引擎。
 *
 * 输入必须是 JSON 可移植的消息内容、状态与元数据；模块不读取 Tavern、不写持久化、
 * 不读取时间或随机数，也不在模块级保存 Converter、RegExp 或可变业务状态。
 */

import { Converter } from "opencc-js";
import { cloneEraPortableJsonV1 } from "@era/vibeflow-contracts";
import { executeExpressionLayer } from "@era/vibeflow-expression/engine";

import { findLatestNewValue } from "./snapshot_query";

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
  /** Stable message MK used as the default deterministic-random seed. */
  readonly randomSourceKey?: string;
  readonly traditionalToSimplified?: boolean;
  /**
   * 逐块推进一步一块的生命周期：只执行 [fromIndex, toIndex) 内的块。
   * 省略时保持既有语义，一次执行整条消息的全部六类指令。
   */
  readonly commandRange?: Readonly<{ readonly fromIndex: number; readonly toIndex: number }>;
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

interface TemplateContext {
  readonly inheritedContent: unknown;
  readonly parentData: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function defineOwn(
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
): readonly (EraCrudCommand & { readonly start: number; readonly end: number })[] {
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

function pathSegments(path: string): string[] {
  const result: string[] = [];
  if (path.charCodeAt(0) === 46) result.push("");
  path.replace(
    /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,
    (match: string, number: string, quote: string, substring: string) => {
      result.push(
        quote ? substring.replace(/\\(\\)?/g, "$1") : number || match,
      );
      return match;
    },
  );
  return result;
}

function isArrayIndex(value: string): boolean {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) return false;
  const index = Number(value);
  return Number.isSafeInteger(index) && index >= 0 && index < 4_294_967_295;
}

function canTraverse(
  value: unknown,
): value is Record<string, unknown> | unknown[] {
  return value !== null && typeof value === "object";
}

function readOwn(
  target: Record<string, unknown> | unknown[],
  key: string,
): unknown {
  return Object.prototype.hasOwnProperty.call(target, key)
    ? (target as Record<string, unknown>)[key]
    : undefined;
}

function getAtPath(target: unknown, path: string): unknown {
  if (!canTraverse(target)) return undefined;
  let cursor: unknown = target;
  for (const segment of pathSegments(path)) {
    if (!canTraverse(cursor)) return undefined;
    cursor = readOwn(cursor, segment);
  }
  return cursor;
}

function hasAtPath(target: unknown, path: string): boolean {
  if (!canTraverse(target)) return false;
  let cursor: unknown = target;
  for (const segment of pathSegments(path)) {
    if (!canTraverse(cursor)) return false;
    if (!Object.prototype.hasOwnProperty.call(cursor, segment)) return false;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return true;
}

function setAtPath(target: unknown, path: string, value: unknown): void {
  if (!canTraverse(target)) return;
  const segments = pathSegments(path);
  if (segments.length === 0) return;
  let cursor: Record<string, unknown> | unknown[] = target;
  for (let index = 0; index < segments.length; index += 1) {
    const key = segments[index];
    if (index === segments.length - 1) {
      defineOwn(cursor, key, cloneCrudValue(value));
      return;
    }
    const child = readOwn(cursor, key);
    if (canTraverse(child)) {
      cursor = child;
    } else {
      const replacement: Record<string, unknown> | unknown[] = isArrayIndex(
        segments[index + 1],
      )
        ? []
        : {};
      defineOwn(cursor, key, replacement);
      cursor = replacement;
    }
  }
}

function unsetAtPath(target: unknown, path: string): void {
  if (!canTraverse(target)) return;
  const segments = pathSegments(path);
  if (segments.length === 0) return;
  let cursor: Record<string, unknown> | unknown[] = target;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const child = readOwn(cursor, segments[index]);
    if (!canTraverse(child)) return;
    cursor = child;
  }
  delete (cursor as Record<string, unknown>)[segments[segments.length - 1]];
}

function isEmptyRecord(value: unknown): boolean {
  return isPlainRecord(value) && Object.keys(value).length === 0;
}

function metaValue(node: unknown, key: string): unknown {
  if (!isPlainRecord(node)) return undefined;
  const meta = node.$meta;
  return isPlainRecord(meta) ? meta[key] : undefined;
}

function resolveTemplate(context: TemplateContext): unknown {
  const variablesContent = isPlainRecord(context.parentData)
    ? context.parentData.$template
    : undefined;
  let merged: unknown = {};
  merged = mergeReplaceArray(merged, context.inheritedContent);
  merged = mergeReplaceArray(merged, variablesContent);
  return isPlainRecord(merged) && Object.keys(merged).length > 0
    ? merged
    : null;
}

function inheritedTemplateContent(
  parentTemplate: unknown,
  key: string,
): unknown {
  if (!isPlainRecord(parentTemplate)) return undefined;
  const prototypeContent = parentTemplate.$template;
  const specificContent = parentTemplate[key];
  if (isPlainRecord(prototypeContent) && isPlainRecord(specificContent)) {
    return mergeReplaceArray(prototypeContent, specificContent);
  }
  if (isPlainRecord(specificContent)) return specificContent;
  if (isPlainRecord(prototypeContent)) return prototypeContent;
  return undefined;
}

function applyTemplate(template: unknown, patch: unknown): unknown {
  if (!isPlainRecord(patch)) return patch;
  if (!template) return patch;
  if (Object.keys(patch).length === 0) return cloneCrudValue(template);
  return mergeReplaceArray(template, patch);
}

function applyInsertAtLevel(
  stat: unknown,
  basePath: string,
  patch: unknown,
  logs: EraCrudEditLog[],
  context: TemplateContext,
): void {
  const localTemplate = resolveTemplate(context);
  const current = basePath ? getAtPath(stat, basePath) : stat;
  const protection = metaValue(current, "unInsertAble");

  if (basePath && typeof current === "undefined") {
    const finalValue = sanitizeArrays(applyTemplate(localTemplate, patch));
    setAtPath(stat, basePath, finalValue);
    logs.push({
      op: "insert",
      path: basePath,
      value_new: cloneCrudValue(finalValue),
    });
    return;
  }

  if (isPlainRecord(current) && isPlainRecord(patch)) {
    const keys = Object.keys(patch);
    const metaOnly = keys.every((key) => key === "$meta");
    if (protection === "all" && keys.length > 0 && !metaOnly) return;
    for (const key of keys) {
      if (
        protection === "self" &&
        key !== "$meta" &&
        !Object.prototype.hasOwnProperty.call(current, key)
      ) {
        continue;
      }
      const subPath = basePath ? `${basePath}.${key}` : key;
      applyInsertAtLevel(stat, subPath, patch[key], logs, {
        inheritedContent: inheritedTemplateContent(localTemplate, key),
        parentData: current,
      });
    }
  }
}

/** 对有序 VariableInsert 根对象应用非破坏性插入与模板规则。 */
export function applyInsert(
  inserts: readonly unknown[],
  initialStat: unknown,
): EraCrudResult {
  const finalStat = cloneCrudValue(initialStat);
  const editLog: EraCrudEditLog[] = [];
  for (const root of inserts ?? []) {
    if (!isPlainRecord(root) || Object.keys(root).length === 0) continue;
    try {
      applyInsertAtLevel(finalStat, "", root, editLog, {
        inheritedContent: null,
        parentData: null,
      });
    } catch {
      // 与候选实现一致：单个根失败不会阻止后续根继续处理。
    }
  }
  return { finalStat, editLog };
}

function selectedMks(
  meta: Readonly<Record<string, unknown>>,
): (string | null)[] {
  return Array.isArray(meta.SelectedMks)
    ? (cloneCrudValue(meta.SelectedMks) as (string | null)[])
    : [];
}

function editLogs(
  meta: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return isPlainRecord(meta.EditLogs) ? meta.EditLogs : {};
}

type RelativeEditResolution =
  | { readonly kind: "not-operator" }
  | { readonly kind: "resolved"; readonly value: number }
  | { readonly kind: "invalid"; readonly diagnostic: EraCrudDiagnostic };

function publicEditPath(path: string): string {
  return path
    .replace(/__DOT__/g, ".")
    .replace(/__DQUOTE__/g, '"')
    .replace(/__SQUOTE__/g, "'");
}

function editDiagnostic(
  code: EraCrudDiagnosticCode,
  path: string,
  message: string,
): EraCrudDiagnostic {
  const publicPath = publicEditPath(path);
  return {
    code,
    path: publicPath,
    message: `${message}（路径 ${publicPath || "(root)"}）`,
  };
}

/**
 * 识别 VariableEdit 叶子上的唯一 `$expr` 数值表达式。
 *
 * 旧 `$inc/$mul/$div` 及任何未知 `$` 控制键一律 fail-closed；普通对象和普通 JSON
 * 直接赋值仍返回 not-operator。表达式的解析、函数图和数值计算委托给独立 root。
 */
export function resolveRelativeEdit(
  patch: unknown,
  current: unknown,
  path: string,
  stat: unknown = {},
  context: EraEditContext = { messageId: 0, meta: {} },
): RelativeEditResolution {
  if (!isPlainRecord(patch)) return { kind: "not-operator" };
  const keys = Object.keys(patch);
  const controlKeys = keys.filter(
    (key) => key.startsWith("$") && key !== "$meta",
  );
  if (controlKeys.length === 0) return { kind: "not-operator" };

  const operator = controlKeys[0];
  if (keys.length !== 1 || controlKeys.length !== 1 || operator !== "$expr") {
    return {
      kind: "invalid",
      diagnostic: editDiagnostic(
        "ERA_EDIT_OPERATOR_INVALID",
        path,
        "数值表达式必须是只含 $expr 的单键对象；$inc、$mul、$div、$sub 和 $set 已不支持。",
      ),
    };
  }

  const operand = patch[operator];
  if (typeof operand !== "string" || operand.trim().length === 0) {
    return {
      kind: "invalid",
      diagnostic: editDiagnostic(
        "ERA_EDIT_OPERATOR_INVALID",
        path,
        "$expr 的值必须是非空表达式字符串。",
      ),
    };
  }
  if (typeof current !== "number" || !Number.isFinite(current)) {
    return {
      kind: "invalid",
      diagnostic: editDiagnostic(
        "ERA_EDIT_TARGET_NOT_NUMERIC",
        path,
        "相对数值更新的目标当前值必须是有限数字。",
      ),
    };
  }
  if (!isPlainRecord(stat)) {
    return {
      kind: "invalid",
      diagnostic: editDiagnostic(
        "ERA_EDIT_OPERATOR_INVALID",
        path,
        "$expr 只能在对象变量状态上求值。",
      ),
    };
  }
  const response = executeExpressionLayer({
    initialState: cloneCrudValue(stat),
    snapshotState: cloneCrudValue(context.layerStartStat ?? stat),
    functionLibrary: context.statFunc ?? {},
    snapshotFunctionLibrary:
      context.layerStartStatFunc ?? context.statFunc ?? {},
    allowSnapshots: true,
    ...(context.randomCursor === undefined
      ? {}
      : {
          randomContext: {
            sourceKey: context.randomCursor.sourceKey,
            drawOffset: context.randomCursor.drawOffset,
          },
        }),
    operations: [{ path: publicEditPath(path), expr: operand }],
  });
  if (context.randomCursor !== undefined) {
    context.randomCursor.drawOffset = response.nextDrawOffset;
  }
  const result = getAtPath(response.finalState, publicEditPath(path));
  if (
    response.diagnostics.length > 0 ||
    typeof result !== "number" ||
    !Number.isFinite(result)
  ) {
    const detail = response.diagnostics[0];
    return {
      kind: "invalid",
      diagnostic: editDiagnostic(
        detail?.code ?? "ERA_EDIT_RESULT_NON_FINITE",
        path,
        detail?.message ?? "$expr 未得到有限数值结果。",
      ),
    };
  }
  return { kind: "resolved", value: Object.is(result, -0) ? 0 : result };
}

function applyEditAtLevel(
  stat: unknown,
  basePath: string,
  patch: unknown,
  logs: EraCrudEditLog[],
  context: EraEditContext,
  orderedMks: readonly (string | null)[],
  historicalLogs: Readonly<Record<string, unknown>>,
  diagnostics: EraCrudDiagnostic[],
): void {
  const current = basePath ? getAtPath(stat, basePath) : stat;
  if (typeof current === "undefined") return;
  const updatable = metaValue(current, "updatable") ?? true;
  const bypass =
    updatable === false &&
    isPlainRecord(patch) &&
    isPlainRecord(patch.$meta) &&
    patch.$meta.updatable === true;
  if (updatable === false && !bypass) return;

  const relative = resolveRelativeEdit(patch, current, basePath, stat, context);
  if (relative.kind === "invalid") {
    diagnostics.push(relative.diagnostic);
    return;
  }
  if (relative.kind === "resolved") {
    if (!basePath || !hasAtPath(stat, basePath)) return;
    setAtPath(stat, basePath, relative.value);
    logs.push({
      op: "update",
      path: basePath,
      value_old: cloneCrudValue(current),
      value_new: relative.value,
    });
    return;
  }
  if (!isPlainRecord(patch)) return;

  for (const key of Object.keys(patch)) {
    const subPath = basePath ? `${basePath}.${key}` : key;
    const valueNew = patch[key];
    if (isPlainRecord(valueNew)) {
      applyEditAtLevel(
        stat,
        subPath,
        valueNew,
        logs,
        context,
        orderedMks,
        historicalLogs,
        diagnostics,
      );
      continue;
    }
    if (!hasAtPath(stat, subPath)) continue;
    let valueOld = findLatestNewValue(
      subPath,
      context.messageId,
      orderedMks,
      historicalLogs,
    );
    if (valueOld === null) valueOld = getAtPath(stat, subPath);
    const cleaned = sanitizeArrays(valueNew);
    setAtPath(stat, subPath, cleaned);
    logs.push({
      op: "update",
      path: subPath,
      value_old: cloneCrudValue(valueOld),
      value_new: cloneCrudValue(cleaned),
    });
  }
}

/** 只更新已存在路径，并生成包含历史旧值的 update 日志。 */
export function applyEdit(
  edits: readonly unknown[],
  initialStat: unknown,
  context: EraEditContext,
): EraCrudResult {
  const result = applyEditWithDiagnostics(edits, initialStat, context);
  return { finalStat: result.finalStat, editLog: result.editLog };
}

function applyEditWithDiagnostics(
  edits: readonly unknown[],
  initialStat: unknown,
  context: EraEditContext,
): EraCrudResult & { readonly diagnostics: readonly EraCrudDiagnostic[] } {
  const finalStat = cloneCrudValue(initialStat);
  const editLog: EraCrudEditLog[] = [];
  const diagnostics: EraCrudDiagnostic[] = [];
  const orderedMks = selectedMks(context.meta);
  const historicalLogs = editLogs(context.meta);
  for (const root of edits ?? []) {
    if (!isPlainRecord(root) || Object.keys(root).length === 0) continue;
    try {
      applyEditAtLevel(
        finalStat,
        "",
        root,
        editLog,
        context,
        orderedMks,
        historicalLogs,
        diagnostics,
      );
    } catch {
      // 单根失败保持容错并继续。
    }
  }
  return { finalStat, editLog, diagnostics };
}

function deleteBypass(patch: unknown): boolean {
  if (!isPlainRecord(patch)) return false;
  const metaPatch = patch.$meta;
  if (isEmptyRecord(metaPatch)) return true;
  return (
    isPlainRecord(metaPatch) &&
    Object.prototype.hasOwnProperty.call(metaPatch, "necessary")
  );
}

function applyDeleteAtLevel(
  stat: unknown,
  basePath: string,
  patch: unknown,
  logs: EraCrudEditLog[],
): void {
  const current = basePath ? getAtPath(stat, basePath) : stat;
  if (typeof current === "undefined") return;
  const necessary = metaValue(current, "necessary");
  const bypass = deleteBypass(patch);

  if (isPlainRecord(patch) && Object.keys(patch).length > 0) {
    if (necessary === "all" && !bypass) return;
    for (const key of Object.keys(patch)) {
      const subPatch = patch[key];
      if (
        necessary === "children" &&
        isEmptyRecord(subPatch) &&
        !(key === "$meta" && bypass)
      ) {
        continue;
      }
      const path = basePath ? `${basePath}.${key}` : key;
      applyDeleteAtLevel(stat, path, subPatch, logs);
    }
    return;
  }

  if (necessary === "self" || necessary === "all" || basePath === "") return;
  const valueOld = cloneCrudValue(current);
  unsetAtPath(stat, basePath);
  logs.push({ op: "delete", path: basePath, value_old: valueOld });
}

/** 按 necessary 保护规则递归删除，并为每个原子删除生成日志。 */
export function applyDelete(
  deletes: readonly unknown[],
  initialStat: unknown,
): EraCrudResult {
  const finalStat = cloneCrudValue(initialStat);
  const editLog: EraCrudEditLog[] = [];
  for (const root of deletes ?? []) {
    if (!isPlainRecord(root) || Object.keys(root).length === 0) continue;
    try {
      applyDeleteAtLevel(finalStat, "", root, editLog);
    } catch {
      // 单根失败保持候选容错语义。
    }
  }
  return { finalStat, editLog };
}

type FunctionMutationKind =
  "function-insert" | "function-edit" | "function-delete";

function functionDiagnostic(
  code: string,
  name: string,
  message: string,
): EraCrudDiagnostic {
  return {
    code,
    path: name,
    message: `${message}（函数 ${name || "(empty)"}）`,
  };
}

/**
 * Expression root owns grammar, purity and the complete function call graph.  The Service
 * only asks it whether a candidate immutable library is admissible before committing it.
 */
function validateFunctionLibrary(
  candidate: Readonly<Record<string, unknown>>,
): EraCrudDiagnostic | null {
  const checked = executeExpressionLayer({
    initialState: {},
    functionLibrary: candidate,
    operations: [],
  });
  const first = checked.diagnostics[0];
  return first
    ? functionDiagnostic(first.code, "<library>", first.message)
    : null;
}

function isEmptyFunctionDelete(value: unknown): boolean {
  return isPlainRecord(value) && Object.keys(value).length === 0;
}

function functionMetadata(value: unknown): Record<string, unknown> | null {
  return isPlainRecord(value) && isPlainRecord(value.$meta)
    ? value.$meta
    : null;
}

function functionMetaDiagnosticForDefinition(
  value: unknown,
  name: string,
): EraCrudDiagnostic | null {
  const meta = functionMetadata(value);
  if (meta === null) return null;
  if (Object.prototype.hasOwnProperty.call(meta, "unInsertAble")) {
    return functionDiagnostic(
      "ERA_FUNCTION_META_UNSUPPORTED",
      name,
      "函数是平面实体，不支持 $meta.unInsertAble。",
    );
  }
  if (meta.necessary === "children") {
    return functionDiagnostic(
      "ERA_FUNCTION_META_UNSUPPORTED",
      name,
      "函数是平面实体，不支持 $meta.necessary: children。",
    );
  }
  return null;
}

function isFunctionMetadataOnlyPatch(
  value: unknown,
): value is Record<string, unknown> {
  return (
    isPlainRecord(value) &&
    Object.keys(value).length === 1 &&
    Object.prototype.hasOwnProperty.call(value, "$meta") &&
    isPlainRecord(value.$meta)
  );
}

function functionEditBypassesProtection(
  current: unknown,
  patch: unknown,
): boolean {
  return (
    metaValue(current, "updatable") === false &&
    isPlainRecord(patch) &&
    isPlainRecord(patch.$meta) &&
    patch.$meta.updatable === true
  );
}

function editFunctionDefinition(current: unknown, patch: unknown): unknown {
  if (!isPlainRecord(current) || !isPlainRecord(patch))
    return cloneCrudValue(patch);
  const patchMeta = functionMetadata(patch);
  if (isFunctionMetadataOnlyPatch(patch) && patchMeta !== null) {
    if (Object.keys(patchMeta).length === 0) return cloneCrudValue(current);
    const next = cloneCrudValue(current) as Record<string, unknown>;
    const nextMeta = mergeReplaceArray(current.$meta, patchMeta);
    defineOwn(next, "$meta", nextMeta);
    return next;
  }

  const next = cloneCrudValue(patch) as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(patch, "$meta")) {
    if (Object.prototype.hasOwnProperty.call(current, "$meta")) {
      defineOwn(next, "$meta", cloneCrudValue(current.$meta));
    }
    return next;
  }
  if (patchMeta !== null) {
    defineOwn(next, "$meta", mergeReplaceArray(current.$meta, patchMeta));
  }
  return next;
}

function deleteFunctionMetadata(
  current: unknown,
  patch: Record<string, unknown>,
): unknown {
  const result = applyDelete([{ $meta: patch.$meta }], current);
  return result.finalStat;
}

function applyFunctionCommands(
  data: readonly unknown[],
  initialLibrary: Readonly<Record<string, unknown>>,
  type: FunctionMutationKind,
): {
  readonly library: Readonly<Record<string, unknown>>;
  readonly log: readonly EraFunctionEditLog[];
  readonly diagnostics: readonly EraCrudDiagnostic[];
} {
  let library = cloneCrudValue(initialLibrary) as Record<string, unknown>;
  const log: EraFunctionEditLog[] = [];
  const diagnostics: EraCrudDiagnostic[] = [];
  for (const root of data) {
    if (!isPlainRecord(root) || Object.keys(root).length === 0) {
      diagnostics.push(
        functionDiagnostic(
          "ERA_FUNCTION_COMMAND_INVALID",
          "",
          "函数指令必须是非空对象。",
        ),
      );
      continue;
    }
    const names = Object.keys(root);
    const invalidName = names.find((name) => {
      const exists = Object.prototype.hasOwnProperty.call(library, name);
      return (
        (type === "function-insert" && exists) ||
        (type === "function-edit" && !exists) ||
        (type === "function-delete" &&
          !isEmptyFunctionDelete(root[name]) &&
          !isFunctionMetadataOnlyPatch(root[name]))
      );
    });
    if (invalidName !== undefined) {
      const exists = Object.prototype.hasOwnProperty.call(library, invalidName);
      const code =
        type === "function-delete"
          ? "ERA_FUNCTION_DELETE_INVALID"
          : type === "function-insert" && exists
            ? "ERA_FUNCTION_ALREADY_EXISTS"
            : "ERA_FUNCTION_NOT_FOUND";
      const message =
        code === "ERA_FUNCTION_DELETE_INVALID"
          ? "FunctionDelete 的函数值必须是空对象。"
          : code === "ERA_FUNCTION_ALREADY_EXISTS"
            ? "FunctionInsert 只能新增不存在的函数。"
            : "FunctionEdit 只能修改既有函数。";
      diagnostics.push(functionDiagnostic(code, invalidName, message));
      continue;
    }

    // A tag is one transaction: compile the complete candidate at once, so forward
    // declarations and mutually non-recursive nested definitions are valid.
    const candidate = cloneCrudValue(library) as Record<string, unknown>;
    const changes: Array<{
      readonly kind: "insert" | "update" | "delete";
      readonly name: string;
      readonly value?: unknown;
    }> = [];
    let metadataDiagnostic: EraCrudDiagnostic | null = null;
    for (const name of names) {
      const current = library[name];
      const patch = root[name];
      if (type === "function-insert") {
        const diagnostic = functionMetaDiagnosticForDefinition(patch, name);
        if (diagnostic !== null) {
          metadataDiagnostic = diagnostic;
          break;
        }
        const next = cloneCrudValue(patch);
        defineOwn(candidate, name, next);
        changes.push({ kind: "insert", name, value: next });
        continue;
      }
      if (type === "function-edit") {
        const proposed = editFunctionDefinition(current, patch);
        const diagnostic = functionMetaDiagnosticForDefinition(proposed, name);
        if (diagnostic !== null) {
          metadataDiagnostic = diagnostic;
          break;
        }
        const locked = metaValue(current, "updatable") === false;
        if (locked && !functionEditBypassesProtection(current, patch)) continue;
        defineOwn(candidate, name, proposed);
        changes.push({ kind: "update", name, value: proposed });
        continue;
      }

      if (isEmptyFunctionDelete(patch)) {
        const necessary = metaValue(current, "necessary");
        if (necessary === "self" || necessary === "all") continue;
        if (Object.prototype.hasOwnProperty.call(library, name)) {
          delete candidate[name];
          changes.push({ kind: "delete", name });
        }
        continue;
      }

      if (!Object.prototype.hasOwnProperty.call(library, name)) continue;
      const proposed = deleteFunctionMetadata(
        current,
        patch as Record<string, unknown>,
      );
      defineOwn(candidate, name, proposed);
      changes.push({ kind: "update", name, value: proposed });
    }
    if (metadataDiagnostic !== null) {
      diagnostics.push(metadataDiagnostic);
      continue;
    }
    const invalid = validateFunctionLibrary(candidate);
    if (invalid !== null) {
      diagnostics.push(invalid);
      continue;
    }
    for (const change of changes) {
      if (change.kind === "delete") {
        const valueOld = cloneCrudValue(library[change.name]);
        delete library[change.name];
        log.push({ op: "delete", name: change.name, value_old: valueOld });
      } else if (change.kind === "insert") {
        defineOwn(library, change.name, cloneCrudValue(change.value));
        log.push({
          op: "insert",
          name: change.name,
          value_new: cloneCrudValue(change.value),
        });
      } else {
        const valueOld = cloneCrudValue(library[change.name]);
        defineOwn(library, change.name, cloneCrudValue(change.value));
        log.push({
          op: "update",
          name: change.name,
          value_old: valueOld,
          value_new: cloneCrudValue(change.value),
        });
      }
    }
  }
  return { library, log, diagnostics };
}

/** 解析并严格按消息内出现顺序执行 Variable 和 Function 六类指令。 */
export function applyMessageCommands(
  input: EraApplyMessageCommandsInput,
): EraApplyMessageCommandsResult {
  const initial = cloneCrudValue(input.initialStat);
  const layerStartStatFunc = cloneCrudValue(
    input.initialStatFunc ?? {},
  ) as Record<string, unknown>;
  const randomCursor =
    typeof input.randomSourceKey === "string" && input.randomSourceKey.length > 0
      ? { sourceKey: input.randomSourceKey, drawOffset: 0 }
      : undefined;
  try {
    const allCommands = parseMessageCommands({
      content: input.content,
      traditionalToSimplified: input.traditionalToSimplified,
    });
    const commands =
      input.commandRange === undefined
        ? allCommands
        : allCommands.slice(
            Math.max(0, input.commandRange.fromIndex),
            Math.max(0, input.commandRange.toIndex),
          );
    let current = initial;
    let currentStatFunc = cloneCrudValue(layerStartStatFunc) as Record<
      string,
      unknown
    >;
    const accumulated: EraCrudEditLog[] = [];
    const functionEditLog: EraFunctionEditLog[] = [];
    const diagnostics: EraCrudDiagnostic[] = [];
    for (const command of commands) {
      let result: EraCrudResult;
      if (command.type === "insert") {
        result = applyInsert(command.data, current);
      } else if (command.type === "edit") {
        const editResult = applyEditWithDiagnostics(command.data, current, {
          messageId: input.messageId,
          meta: input.meta,
          layerStartStat: initial,
          statFunc: currentStatFunc,
          layerStartStatFunc,
          randomCursor,
        });
        diagnostics.push(...editResult.diagnostics);
        result = editResult;
      } else if (command.type === "delete") {
        result = applyDelete(command.data, current);
      } else {
        const functionResult = applyFunctionCommands(
          command.data,
          currentStatFunc,
          command.type,
        );
        currentStatFunc = cloneCrudValue(functionResult.library) as Record<
          string,
          unknown
        >;
        functionEditLog.push(...functionResult.log);
        diagnostics.push(...functionResult.diagnostics);
        result = { finalStat: current, editLog: [] };
      }
      current = result.finalStat;
      accumulated.push(...result.editLog);
    }
    const exposesFunctionState =
      Object.keys(layerStartStatFunc).length > 0 ||
      commands.some((command) => command.type.startsWith("function-"));
    return {
      finalStat: current,
      editLog: accumulated,
      ...(exposesFunctionState
        ? { finalStatFunc: currentStatFunc, functionEditLog }
        : {}),
      commands,
      diagnostics,
      ...(randomCursor === undefined
        ? {}
        : {
            randomDrawsConsumed: randomCursor.drawOffset,
            nextRandomDrawOffset: randomCursor.drawOffset,
          }),
    };
  } catch {
    const exposesFunctionState = Object.keys(layerStartStatFunc).length > 0;
    return {
      finalStat: initial,
      editLog: [],
      ...(exposesFunctionState
        ? { finalStatFunc: layerStartStatFunc, functionEditLog: [] }
        : {}),
      commands: [],
      diagnostics: [],
      ...(randomCursor === undefined
        ? {}
        : {
            randomDrawsConsumed: randomCursor.drawOffset,
            nextRandomDrawOffset: randomCursor.drawOffset,
          }),
    };
  }
}
