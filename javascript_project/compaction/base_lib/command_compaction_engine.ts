/**
 * Pure ERA command-layer interpreter and conservative compactor.
 *
 * This root deliberately owns no Tavern/Sidecar state.  It accepts one message
 * plus its layer-start data and returns a replacement text only where the
 * standard ERA command language can be proven safe to shorten.
 */
import {
  compileFunctionLibrary,
  countAutomaticRandomDraws,
  executeExpressionLayer,
  parseExpression,
  type Ast,
} from "@era/vibeflow-expression/engine";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type CommandKind =
  | "insert"
  | "edit"
  | "delete"
  | "function-insert"
  | "function-edit"
  | "function-delete";

export interface CommandDiagnostic {
  readonly [key: string]: unknown;
  readonly code: string;
  readonly message: string;
  readonly commandIndex?: number;
  readonly path?: string;
}

export interface ParsedCommand {
  readonly [key: string]: unknown;
  readonly index: number;
  readonly kind: CommandKind;
  readonly tag: string;
  readonly data: readonly Record<string, unknown>[];
  readonly start: number;
  readonly end: number;
  readonly raw: string;
}

export interface CommandCompactionRequest {
  readonly [key: string]: unknown;
  readonly content: string;
  readonly initialStatData: Readonly<Record<string, unknown>>;
  readonly initialStatFunc?: Readonly<Record<string, unknown>>;
  /** 整条消息开始时的变量快照；分段压缩时与当前段起点不同。 */
  readonly snapshotStatData?: Readonly<Record<string, unknown>>;
  /** 整条消息开始时的函数快照；供 @f(...) 在任意 scope 段保持同一闭包。 */
  readonly snapshotStatFunc?: Readonly<Record<string, unknown>>;
  readonly eraMeta?: Readonly<Record<string, unknown>>;
  readonly templateContext?: Readonly<Record<string, unknown>>;
  /** Service passes the sealed message MK; no target path or persistent cursor. */
  readonly randomContext?: {
    readonly sourceKey: string;
    readonly drawOffset: number;
  };
}

export interface CommandCompactionResponse {
  readonly [key: string]: unknown;
  readonly status: "compacted" | "partial" | "unchanged" | "invalid";
  readonly content: string;
  readonly finalStatData: Readonly<Record<string, unknown>>;
  readonly finalStatFunc: Readonly<Record<string, unknown>>;
  readonly diagnostics: readonly CommandDiagnostic[];
  readonly reasons: readonly string[];
  readonly parsedCommands: readonly ParsedCommand[];
  readonly nextRandomDrawOffset: number;
}

export interface ParsedLayer {
  readonly [key: string]: unknown;
  readonly request: CommandCompactionRequest;
  readonly commands: readonly ParsedCommand[];
  readonly diagnostics: readonly CommandDiagnostic[];
}

export interface SemanticTrace extends ParsedLayer {
  readonly [key: string]: unknown;
  readonly finalStatData: Readonly<Record<string, unknown>>;
  readonly finalStatFunc: Readonly<Record<string, unknown>>;
  readonly diagnostics: readonly CommandDiagnostic[];
  readonly nextRandomDrawOffset: number;
}

export interface Candidate extends SemanticTrace {
  readonly [key: string]: unknown;
  readonly replacements: ReadonlyMap<number, string>;
  readonly reasons: readonly string[];
}

function tagInfo(value: string): { readonly kind: CommandKind; readonly tag: string } | null {
  if (value === "variableinsert") return { kind: "insert", tag: "VariableInsert" };
  if (value === "variableedit") return { kind: "edit", tag: "VariableEdit" };
  if (value === "variabledelete") return { kind: "delete", tag: "VariableDelete" };
  if (value === "functioninsert") return { kind: "function-insert", tag: "FunctionInsert" };
  if (value === "functionedit") return { kind: "function-edit", tag: "FunctionEdit" };
  if (value === "functiondelete") return { kind: "function-delete", tag: "FunctionDelete" };
  return null;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function plain(value: unknown): value is Record<string, unknown> {
  if (!record(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diagnostic(
  code: string,
  message: string,
  commandIndex?: number,
  path?: string,
): CommandDiagnostic {
  return { code, message, ...(commandIndex === undefined ? {} : { commandIndex }), ...(path === undefined ? {} : { path }) };
}

function stripFence(text: string): string {
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(text.trim());
  return match ? match[1]! : text.trim();
}

function parseData(text: string, commandIndex: number): {
  readonly data: readonly Record<string, unknown>[];
  readonly diagnostic?: CommandDiagnostic;
} {
  try {
    const parsed = JSON.parse(stripFence(text));
    const values = Array.isArray(parsed) ? parsed : [parsed];
    if (!values.every(plain)) {
      return { data: [], diagnostic: diagnostic("ERA_COMPACT_COMMAND_DATA_INVALID", "指令内容必须是 JSON 对象或对象数组。", commandIndex) };
    }
    return { data: values as readonly Record<string, unknown>[] };
  } catch (error) {
    return { data: [], diagnostic: diagnostic("ERA_COMPACT_COMMAND_JSON_INVALID", `指令 JSON 无法解析：${error instanceof Error ? error.message : String(error)}`, commandIndex) };
  }
}

export function parseCommandLayer(input: unknown): ParsedLayer {
  const source = record(input) ? input : {};
  const request: CommandCompactionRequest = {
    content: typeof source.content === "string" ? source.content : "",
    initialStatData: plain(source.initialStatData) ? clone(source.initialStatData) : {},
    initialStatFunc: plain(source.initialStatFunc) ? clone(source.initialStatFunc) : {},
    snapshotStatData: plain(source.snapshotStatData)
      ? clone(source.snapshotStatData)
      : plain(source.initialStatData) ? clone(source.initialStatData) : {},
    snapshotStatFunc: plain(source.snapshotStatFunc)
      ? clone(source.snapshotStatFunc)
      : plain(source.initialStatFunc) ? clone(source.initialStatFunc) : {},
    eraMeta: plain(source.eraMeta) ? clone(source.eraMeta) : {},
    templateContext: plain(source.templateContext) ? clone(source.templateContext) : {},
    randomContext:
      plain(source.randomContext) &&
      typeof source.randomContext.sourceKey === "string" &&
      source.randomContext.sourceKey.length > 0 &&
      Number.isSafeInteger(source.randomContext.drawOffset) &&
      (source.randomContext.drawOffset as number) >= 0
        ? {
            sourceKey: source.randomContext.sourceKey,
            drawOffset: source.randomContext.drawOffset as number,
          }
        : undefined,
  };
  const commands: ParsedCommand[] = [];
  const diagnostics: CommandDiagnostic[] = [];
  const pattern = /<((?:Variable|Function)(?:Insert|Edit|Delete))>\s*([\s\S]*?)\s*<\/\1>/giu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(request.content)) !== null) {
    const info = tagInfo((match[1] ?? "").toLowerCase());
    if (!info) continue;
    const index = commands.length;
    const parsed = parseData(match[2] ?? "", index);
    if (parsed.diagnostic) diagnostics.push(parsed.diagnostic);
    commands.push({
      index,
      kind: info.kind,
      tag: info.tag,
      data: parsed.data,
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
    });
  }
  return { request, commands, diagnostics };
}

function getAt(root: unknown, segments: readonly string[]): unknown {
  let cursor: unknown = root;
  for (const segment of segments) {
    if (!record(cursor) || !Object.prototype.hasOwnProperty.call(cursor, segment)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

function hasAt(root: unknown, segments: readonly string[]): boolean {
  let cursor: unknown = root;
  for (const segment of segments) {
    if (!record(cursor) || !Object.prototype.hasOwnProperty.call(cursor, segment)) return false;
    cursor = cursor[segment];
  }
  return true;
}

function setAt(root: Record<string, unknown>, segments: readonly string[], value: unknown): void {
  let cursor: Record<string, unknown> = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]!;
    if (!plain(cursor[key])) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]!] = clone(value);
}

function unsetAt(root: Record<string, unknown>, segments: readonly string[]): void {
  let cursor: unknown = root;
  for (const segment of segments.slice(0, -1)) {
    if (!record(cursor) || !Object.prototype.hasOwnProperty.call(cursor, segment)) return;
    cursor = cursor[segment];
  }
  if (record(cursor)) delete cursor[segments[segments.length - 1]!];
}

function metaValue(value: unknown, key: string): unknown {
  return plain(value) && plain(value.$meta) ? value.$meta[key] : undefined;
}

function merge(left: unknown, right: unknown): unknown {
  if (!plain(left) || !plain(right)) return clone(right);
  const output = clone(left);
  for (const [key, value] of Object.entries(right)) {
    output[key] = Object.prototype.hasOwnProperty.call(output, key)
      ? merge(output[key], value)
      : clone(value);
  }
  return output;
}

function inheritedTemplateContent(parentTemplate: unknown, key: string): unknown {
  if (!plain(parentTemplate)) return undefined;
  const general = parentTemplate.$template;
  const specific = parentTemplate[key];
  if (plain(general) && plain(specific)) return merge(general, specific);
  return plain(specific) ? specific : plain(general) ? general : undefined;
}

function resolvedTemplate(inherited: unknown, parentData: unknown): unknown {
  const own = plain(parentData) ? parentData.$template : undefined;
  const result = merge(plain(inherited) ? inherited : {}, plain(own) ? own : {});
  return plain(result) && Object.keys(result).length > 0 ? result : undefined;
}

function applyTemplate(template: unknown, patch: unknown): unknown {
  if (!plain(patch) || !plain(template)) return clone(patch);
  return Object.keys(patch).length === 0 ? clone(template) : merge(template, patch);
}

function applyInsertAt(
  stat: Record<string, unknown>,
  segments: readonly string[],
  patch: unknown,
  inheritedTemplate: unknown = undefined,
  parentData: unknown = undefined,
): void {
  const current = getAt(stat, segments);
  const localTemplate = resolvedTemplate(inheritedTemplate, parentData);
  if (segments.length > 0 && current === undefined) {
    setAt(stat, segments, applyTemplate(localTemplate, patch));
    return;
  }
  if (!plain(current) || !plain(patch)) return;
  const protection = metaValue(current, "unInsertAble");
  const keys = Object.keys(patch);
  const metaOnly = keys.every((key) => key === "$meta");
  if (protection === "all" && keys.length > 0 && !metaOnly) return;
  for (const key of keys) {
    if (protection === "self" && key !== "$meta" && !Object.prototype.hasOwnProperty.call(current, key)) continue;
    applyInsertAt(
      stat,
      [...segments, key],
      patch[key],
      inheritedTemplateContent(localTemplate, key),
      current,
    );
  }
}

function expressionValue(
  stat: Record<string, unknown>,
  layerStart: Record<string, unknown>,
  statFunc: Record<string, unknown>,
  startFunc: Record<string, unknown>,
  path: readonly string[],
  expr: string,
  randomCursor: { sourceKey: string; drawOffset: number } | null,
): { readonly value?: number; readonly diagnostic?: CommandDiagnostic } {
  const request = {
    initialState: stat,
    snapshotState: layerStart,
    functionLibrary: statFunc,
    snapshotFunctionLibrary: startFunc,
    allowSnapshots: true,
    operations: [{ path: path.join("."), expr }],
    ...(randomCursor ? { randomContext: randomCursor } : {}),
  };
  const response = executeExpressionLayer(request);
  if (randomCursor) randomCursor.drawOffset = response.nextDrawOffset;
  const value = getAt(response.finalState, path);
  const issue = response.diagnostics[0];
  if (issue || typeof value !== "number" || !Number.isFinite(value)) {
    return { diagnostic: diagnostic(issue?.code ?? "ERA_COMPACT_EXPR_NON_FINITE", issue?.message ?? "$expr 必须得到有限数值。", undefined, path.join(".")) };
  }
  return { value };
}

function applyEditAt(
  stat: Record<string, unknown>,
  layerStart: Record<string, unknown>,
  statFunc: Record<string, unknown>,
  startFunc: Record<string, unknown>,
  segments: readonly string[],
  patch: unknown,
  diagnostics: CommandDiagnostic[],
  commandIndex: number,
  randomCursor: { sourceKey: string; drawOffset: number } | null,
): void {
  const current = getAt(stat, segments);
  if (segments.length > 0 && current === undefined) return;
  if (metaValue(current, "updatable") === false) {
    const unlock = plain(patch) && plain(patch.$meta) && patch.$meta.updatable === true;
    if (!unlock) return;
  }
  if (plain(patch) && Object.keys(patch).length === 1 && typeof patch.$expr === "string") {
    if (segments.length === 0 || !hasAt(stat, segments)) return;
    const resolved = expressionValue(
      stat,
      layerStart,
      statFunc,
      startFunc,
      segments,
      patch.$expr,
      randomCursor,
    );
    if (resolved.diagnostic) diagnostics.push({ ...resolved.diagnostic, commandIndex });
    else setAt(stat, segments, resolved.value);
    return;
  }
  if (!plain(patch)) {
    if (segments.length > 0 && hasAt(stat, segments)) setAt(stat, segments, patch);
    return;
  }
  for (const [key, value] of Object.entries(patch)) {
    applyEditAt(stat, layerStart, statFunc, startFunc, [...segments, key], value, diagnostics, commandIndex, randomCursor);
  }
}

function deleteBypass(patch: unknown): boolean {
  return plain(patch) && plain(patch.$meta) && Object.prototype.hasOwnProperty.call(patch.$meta, "necessary");
}

function emptyRecord(value: unknown): boolean {
  return plain(value) && Object.keys(value).length === 0;
}

function applyDeleteAt(stat: Record<string, unknown>, segments: readonly string[], patch: unknown): void {
  const current = getAt(stat, segments);
  if (segments.length > 0 && current === undefined) return;
  const necessary = metaValue(current, "necessary");
  const bypass = deleteBypass(patch);
  if (plain(patch) && Object.keys(patch).length > 0) {
    if (necessary === "all" && !bypass) return;
    for (const [key, value] of Object.entries(patch)) {
      if (necessary === "children" && emptyRecord(value) && !(key === "$meta" && bypass)) continue;
      applyDeleteAt(stat, [...segments, key], value);
    }
    return;
  }
  if (segments.length === 0 || necessary === "self" || necessary === "all") return;
  unsetAt(stat, segments);
}

function functionDiagnostic(code: string, message: string, commandIndex: number, name?: string): CommandDiagnostic {
  return diagnostic(code, message, commandIndex, name);
}

function functionMetaInvalid(value: unknown): string | null {
  const meta = plain(value) && plain(value.$meta) ? value.$meta : null;
  if (!meta) return null;
  if (Object.prototype.hasOwnProperty.call(meta, "unInsertAble")) return "函数是平面实体，不支持 $meta.unInsertAble。";
  if (meta.necessary === "children") return "函数是平面实体，不支持 $meta.necessary: children。";
  return null;
}

function validateFunctions(library: Record<string, unknown>): CommandDiagnostic | null {
  const result = executeExpressionLayer({ initialState: {}, functionLibrary: library, operations: [] });
  const issue = result.diagnostics[0];
  return issue ? diagnostic(issue.code, issue.message, undefined, "<library>") : null;
}

function editFunction(current: unknown, patch: unknown): unknown {
  if (!plain(current) || !plain(patch)) return clone(patch);
  const patchMeta = plain(patch.$meta) ? patch.$meta : null;
  if (Object.keys(patch).length === 1 && patchMeta) {
    const next = clone(current);
    next.$meta = merge(current.$meta, patchMeta);
    return next;
  }
  const next = clone(patch);
  if (!Object.prototype.hasOwnProperty.call(patch, "$meta") && Object.prototype.hasOwnProperty.call(current, "$meta")) next.$meta = clone(current.$meta);
  else if (patchMeta) next.$meta = merge(current.$meta, patchMeta);
  return next;
}

function applyFunction(
  library: Record<string, unknown>,
  type: Extract<CommandKind, `function-${string}`>,
  data: readonly Record<string, unknown>[],
  diagnostics: CommandDiagnostic[],
  commandIndex: number,
): Record<string, unknown> {
  let current = clone(library);
  for (const root of data) {
    if (Object.keys(root).length === 0) {
      diagnostics.push(functionDiagnostic("ERA_FUNCTION_COMMAND_INVALID", "函数指令必须是非空对象。", commandIndex));
      continue;
    }
    const candidate = clone(current);
    const issues: CommandDiagnostic[] = [];
    for (const [name, patch] of Object.entries(root)) {
      const exists = Object.prototype.hasOwnProperty.call(current, name);
      if (type === "function-insert") {
        if (exists) { issues.push(functionDiagnostic("ERA_FUNCTION_ALREADY_EXISTS", "FunctionInsert 只能新增不存在的函数。", commandIndex, name)); continue; }
        const invalid = functionMetaInvalid(patch);
        if (invalid) { issues.push(functionDiagnostic("ERA_FUNCTION_META_UNSUPPORTED", invalid, commandIndex, name)); continue; }
        candidate[name] = clone(patch);
      } else if (type === "function-edit") {
        if (!exists) { issues.push(functionDiagnostic("ERA_FUNCTION_NOT_FOUND", "FunctionEdit 只能修改既有函数。", commandIndex, name)); continue; }
        if (metaValue(current[name], "updatable") === false && !(plain(patch) && plain(patch.$meta) && patch.$meta.updatable === true)) continue;
        const next = editFunction(current[name], patch);
        const invalid = functionMetaInvalid(next);
        if (invalid) { issues.push(functionDiagnostic("ERA_FUNCTION_META_UNSUPPORTED", invalid, commandIndex, name)); continue; }
        candidate[name] = next;
      } else {
        if (!plain(patch)) { issues.push(functionDiagnostic("ERA_FUNCTION_DELETE_INVALID", "FunctionDelete 的函数值必须是空对象。", commandIndex, name)); continue; }
        if (Object.keys(patch).length === 0) {
          if (exists && !["self", "all"].includes(String(metaValue(current[name], "necessary")))) delete candidate[name];
        } else if (Object.keys(patch).length === 1 && plain(patch.$meta) && exists) {
          const next = clone(current[name]) as Record<string, unknown>;
          const metaPatch = patch.$meta as Record<string, unknown>;
          if (plain(next.$meta)) {
            for (const key of Object.keys(metaPatch)) delete (next.$meta as Record<string, unknown>)[key];
          }
          candidate[name] = next;
        } else issues.push(functionDiagnostic("ERA_FUNCTION_DELETE_INVALID", "FunctionDelete 的函数值必须是空对象。", commandIndex, name));
      }
    }
    if (issues.length > 0) {
      diagnostics.push(...issues);
      continue;
    }
    const invalid = validateFunctions(candidate);
    if (invalid) { diagnostics.push({ ...invalid, commandIndex }); continue; }
    current = candidate;
  }
  return current;
}

export function executeOriginalSemantics(parsed: ParsedLayer): SemanticTrace {
  const stat = clone(parsed.request.initialStatData) as Record<string, unknown>;
  const start = clone(parsed.request.snapshotStatData ?? parsed.request.initialStatData) as Record<string, unknown>;
  let functions = clone(parsed.request.initialStatFunc ?? {}) as Record<string, unknown>;
  const startFunctions = clone(parsed.request.snapshotStatFunc ?? parsed.request.initialStatFunc ?? {}) as Record<string, unknown>;
  const diagnostics = [...parsed.diagnostics];
  const randomCursor = parsed.request.randomContext
    ? { ...parsed.request.randomContext }
    : null;
  for (const command of parsed.commands) {
    if (command.data.length === 0) continue;
    if (command.kind === "insert") for (const patch of command.data) applyInsertAt(stat, [], patch);
    else if (command.kind === "edit") for (const patch of command.data) applyEditAt(stat, start, functions, startFunctions, [], patch, diagnostics, command.index, randomCursor);
    else if (command.kind === "delete") for (const patch of command.data) applyDeleteAt(stat, [], patch);
    else functions = applyFunction(functions, command.kind, command.data, diagnostics, command.index);
  }
  return {
    ...parsed,
    finalStatData: stat,
    finalStatFunc: functions,
    diagnostics,
    nextRandomDrawOffset:
      randomCursor?.drawOffset ?? parsed.request.randomContext?.drawOffset ?? 0,
  };
}

function hasMeta(value: unknown): boolean {
  if (!plain(value)) return false;
  if (Object.prototype.hasOwnProperty.call(value, "$meta") || Object.prototype.hasOwnProperty.call(value, "$template")) return true;
  return Object.values(value).some(hasMeta);
}

function flattenNumericEdits(
  patch: unknown,
  prefix: readonly string[] = [],
  output: Array<{ readonly path: string; readonly expr: string; readonly source: "expr" | "literal"; readonly literal?: number }> = [],
): boolean {
  if (!plain(patch)) return false;
  if (Object.prototype.hasOwnProperty.call(patch, "$meta") || Object.prototype.hasOwnProperty.call(patch, "$template")) return false;
  if (Object.keys(patch).length === 1 && typeof patch.$expr === "string") {
    if (prefix.length === 0) return false;
    output.push({ path: prefix.join("."), expr: patch.$expr, source: "expr" });
    return true;
  }
  for (const [key, value] of Object.entries(patch)) {
    if (plain(value)) {
      if (!flattenNumericEdits(value, [...prefix, key], output)) return false;
    } else if (typeof value === "number" && Number.isFinite(value)) output.push({ path: [...prefix, key].join("."), expr: JSON.stringify(value), source: "literal", literal: value });
    else return false;
  }
  return output.length > 0;
}

function nestingRecord(paths: readonly { readonly path: string; readonly value: number | { readonly $expr: string } }[]): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  for (const item of paths) {
    const parts = item.path.split(".");
    let cursor = result;
    for (const part of parts.slice(0, -1)) {
      if (Object.prototype.hasOwnProperty.call(cursor, part) && !plain(cursor[part])) return null;
      cursor[part] ??= {};
      cursor = cursor[part] as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1]!;
    if (plain(cursor[leaf])) return null;
    cursor[leaf] = item.value;
  }
  return result;
}

export function renderTag(tag: string, data: Record<string, unknown>): string {
  return `<${tag}>\n${JSON.stringify(data)}\n</${tag}>`;
}

function mergeInsertPatch(left: unknown, right: unknown): unknown | null {
  if (!plain(left) || !plain(right) || hasMeta(left) || hasMeta(right)) return null;
  const output = clone(left);
  for (const [key, value] of Object.entries(right)) {
    if (!Object.prototype.hasOwnProperty.call(output, key)) output[key] = clone(value);
    else if (plain(output[key]) && plain(value)) {
      const merged = mergeInsertPatch(output[key], value);
      if (merged === null) return null;
      output[key] = merged;
    } else if (!plain(output[key]) && plain(value)) {
      // If the earlier Insert created a primitive, a later object patch can still
      // matter when an edited earlier layer makes the pre-existing value an object.
      return null;
    }
    // Existing leaves are intentionally first-wins: the second strict Insert is a no-op.
  }
  return output;
}

function allCommandData(command: ParsedCommand): Record<string, unknown> | null {
  if (command.data.length !== 1) return null;
  return command.data[0] ?? null;
}

function compactEditRun(trace: SemanticTrace, commands: readonly ParsedCommand[]): string | null {
  const operations: Array<{ readonly path: string; readonly expr: string; readonly source: "expr" | "literal"; readonly literal?: number }> = [];
  for (const command of commands) {
    const data = allCommandData(command);
    if (!data || !flattenNumericEdits(data, [], operations)) return null;
  }
  const response = executeExpressionLayer({
    initialState: trace.request.initialStatData,
    snapshotState: trace.request.snapshotStatData ?? trace.request.initialStatData,
    functionLibrary: trace.request.initialStatFunc ?? {},
    snapshotFunctionLibrary: trace.request.snapshotStatFunc ?? trace.request.initialStatFunc ?? {},
    allowSnapshots: true,
    operations,
    ...(trace.request.randomContext
      ? { randomContext: trace.request.randomContext }
      : {}),
  });
  if (response.diagnostics.length > 0) return null;
  const sourceByPath = new Map<string, "expr" | "literal" | "mixed">();
  const lastLiteralByPath = new Map<string, number>();
  for (const operation of operations) {
    const prior = sourceByPath.get(operation.path);
    sourceByPath.set(operation.path, prior === undefined || prior === operation.source ? operation.source : "mixed");
    if (operation.source === "literal") lastLiteralByPath.set(operation.path, operation.literal!);
  }
  if ([...sourceByPath.values()].includes("mixed")) return null;
  const output = nestingRecord(response.compactedOperations.map((item) => {
    const source = sourceByPath.get(item.path);
    return source === "literal"
      ? { path: item.path, value: lastLiteralByPath.get(item.path)! }
      : { path: item.path, value: { $expr: item.value.$expr } };
  }));
  return output && Object.keys(output).length > 0 ? renderTag("VariableEdit", output) : "";
}

function pathConflict(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`);
}

function operationRefs(ast: Ast): readonly string[] {
  const refs = new Set<string>();
  const visit = (item: Ast): void => {
    if (item.kind === "ref") {
      if (!item.snapshot) refs.add(item.path.join("."));
      return;
    }
    if (item.kind === "unary") visit(item.value);
    else if (item.kind === "binary") {
      visit(item.left);
      visit(item.right);
    } else if (item.kind === "call") for (const arg of item.args) visit(arg);
  };
  visit(ast);
  return [...refs];
}

function commandExpressionFacts(
  trace: SemanticTrace,
  command: ParsedCommand,
): {
  readonly automaticRandom: boolean;
  readonly paths: readonly string[];
  readonly refs: readonly string[];
  readonly flattenable: boolean;
} {
  const operations: Array<{
    readonly path: string;
    readonly expr: string;
    readonly source: "expr" | "literal";
    readonly literal?: number;
  }> = [];
  const data = allCommandData(command);
  if (!data || !flattenNumericEdits(data, [], operations))
    return { automaticRandom: false, paths: [], refs: [], flattenable: false };
  const current = compileFunctionLibrary(trace.request.initialStatFunc ?? {});
  const snapshot = compileFunctionLibrary(
    trace.request.snapshotStatFunc ?? trace.request.initialStatFunc ?? {},
  );
  const refs = new Set<string>();
  let automaticRandom = false;
  for (const operation of operations) {
    const parsed = parseExpression(operation.expr, true);
    if (!parsed.ast) continue;
    if (countAutomaticRandomDraws(parsed.ast, current, snapshot) > 0)
      automaticRandom = true;
    for (const ref of operationRefs(parsed.ast)) refs.add(ref);
  }
  return {
    automaticRandom,
    paths: operations.map((operation) => operation.path),
    refs: [...refs],
    flattenable: true,
  };
}

function segmentDoesNotDependOnPriorChanges(
  facts: readonly ReturnType<typeof commandExpressionFacts>[],
  priorPaths: ReadonlySet<string>,
): boolean {
  return facts.every((fact) =>
    fact.refs.every(
      (ref) => ![...priorPaths].some((path) => pathConflict(ref, path)),
    ),
  );
}

function compactInsertRun(commands: readonly ParsedCommand[]): string | null {
  let merged: unknown = {};
  for (const command of commands) {
    const data = allCommandData(command);
    if (!data) return null;
    const next = mergeInsertPatch(merged, data);
    if (next === null) return null;
    merged = next;
  }
  return plain(merged) && Object.keys(merged).length > 0 ? renderTag("VariableInsert", merged) : null;
}

export function candidateFor(analysis: DependencyAnalysis): Candidate {
  const { trace } = analysis;
  const replacements = new Map<number, string>();
  const reasons: string[] = [];
  if (trace.diagnostics.length > 0) return { ...trace, replacements, reasons: ["原命令含诊断，保留全部标签。"] };
  let cursor = 0;
  while (cursor < trace.commands.length) {
    const kind = trace.commands[cursor]!.kind;
    let end = cursor + 1;
    while (end < trace.commands.length && trace.commands[end]!.kind === kind) end += 1;
    const run = trace.commands.slice(cursor, end);
    let replacement: string | null = null;
    if (kind === "edit") {
      if (cursor === 0) {
        const facts = run.map((command) => analysis.facts[command.index]!);
        const priorPaths = new Set<string>();
        let segmentStart = 0;
        const compactSegment = (segmentEnd: number): void => {
          if (segmentEnd <= segmentStart) return;
          const segment = run.slice(segmentStart, segmentEnd);
          const segmentFacts = facts.slice(segmentStart, segmentEnd);
          if (
            segmentFacts.every((fact) => fact.flattenable) &&
            segmentDoesNotDependOnPriorChanges(segmentFacts, priorPaths)
          ) {
            const compacted = compactEditRun(trace, segment);
            if (
              compacted !== null &&
              (segment.length > 1 || compacted !== segment[0]!.raw)
            ) {
              replacements.set(segment[0]!.index, compacted);
              for (const command of segment.slice(1))
                replacements.set(command.index, "");
            }
          } else {
            reasons.push(
              `${segment.map((command) => command.tag).join("/")} 保留：依赖随机屏障或更早命令改变的路径。`,
            );
          }
          for (const fact of segmentFacts)
            for (const path of fact.paths) priorPaths.add(path);
        };
        for (let index = 0; index < run.length; index += 1) {
          if (!facts[index]!.automaticRandom) continue;
          compactSegment(index);
          for (const path of facts[index]!.paths) priorPaths.add(path);
          reasons.push(`${run[index]!.tag} 保留：包含自动 random 调用。`);
          segmentStart = index + 1;
        }
        compactSegment(run.length);
        replacement = null;
      } else
        reasons.push(`${run.map((command) => command.tag).join("/")} 保留：前序命令会改变该区间的层起始语义。`);
    }
    else if (kind === "insert") replacement = compactInsertRun(run);
    else reasons.push(`${run.map((command) => command.tag).join("/")} 保留：尚无可证明的通用重写规则。`);
    if (replacement !== null && (run.length > 1 || replacement !== run[0]!.raw)) {
      replacements.set(run[0]!.index, replacement);
      for (const command of run.slice(1)) replacements.set(command.index, "");
    }
    cursor = end;
  }
  return { ...trace, replacements, reasons };
}

export function render(trace: SemanticTrace, replacements: ReadonlyMap<number, string>): string {
  let content = trace.request.content;
  for (const command of [...trace.commands].sort((left, right) => right.start - left.start)) {
    const replacement = replacements.get(command.index);
    if (replacement !== undefined) content = `${content.slice(0, command.start)}${replacement}${content.slice(command.end)}`;
  }
  return content;
}

export function equivalent(trace: SemanticTrace, content: string): boolean {
  const replay = executeOriginalSemantics(parseCommandLayer({ ...trace.request, content }));
  const sameDiagnostics = replay.diagnostics.length === trace.diagnostics.length && replay.diagnostics.every((issue, index) => {
    const expected = trace.diagnostics[index];
    return expected !== undefined && issue.code === expected.code && issue.path === expected.path;
  });
  return sameDiagnostics &&
    equal(replay.finalStatData, trace.finalStatData) &&
    equal(replay.finalStatFunc, trace.finalStatFunc) &&
    replay.nextRandomDrawOffset === trace.nextRandomDrawOffset;
}


/** Facts used by rewriting are computed at the explicit analysis stage. */
export interface DependencyAnalysis {
  readonly [key: string]: unknown;
  readonly trace: SemanticTrace;
  readonly facts: Readonly<Record<number, ReturnType<typeof commandExpressionFacts>>>;
}
export function analyzeDependencies(trace: SemanticTrace): DependencyAnalysis {
  const facts: Record<number, ReturnType<typeof commandExpressionFacts>> = {};
  if (trace.diagnostics.length === 0) {
    for (const command of trace.commands) {
      if (command.kind !== "edit") break;
      facts[command.index] = commandExpressionFacts(trace, command);
    }
  }
  return { trace, facts };
}
