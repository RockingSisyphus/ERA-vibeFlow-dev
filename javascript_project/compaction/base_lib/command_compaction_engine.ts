/**
 * Pure ERA command-layer interpreter and conservative compactor.
 *
 * This root deliberately owns no Tavern/Sidecar state.  It accepts one message
 * plus its layer-start data and returns a replacement text only where the
 * standard ERA command language can be proven safe to shorten.
 */
import { executeExpressionLayer } from "@era/vibeflow-expression/engine";

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
  readonly code: string;
  readonly message: string;
  readonly commandIndex?: number;
  readonly path?: string;
}

export interface ParsedCommand {
  readonly index: number;
  readonly kind: CommandKind;
  readonly tag: string;
  readonly data: readonly Record<string, unknown>[];
  readonly start: number;
  readonly end: number;
  readonly raw: string;
}

export interface CommandCompactionRequest {
  readonly content: string;
  readonly initialStatData: Readonly<Record<string, unknown>>;
  readonly initialStatFunc?: Readonly<Record<string, unknown>>;
  /** 整条消息开始时的变量快照；分段压缩时与当前段起点不同。 */
  readonly snapshotStatData?: Readonly<Record<string, unknown>>;
  /** 整条消息开始时的函数快照；供 @f(...) 在任意 scope 段保持同一闭包。 */
  readonly snapshotStatFunc?: Readonly<Record<string, unknown>>;
  readonly eraMeta?: Readonly<Record<string, unknown>>;
  readonly templateContext?: Readonly<Record<string, unknown>>;
}

export interface CommandCompactionResponse {
  readonly status: "compacted" | "partial" | "unchanged" | "invalid";
  readonly content: string;
  readonly finalStatData: Readonly<Record<string, unknown>>;
  readonly finalStatFunc: Readonly<Record<string, unknown>>;
  readonly diagnostics: readonly CommandDiagnostic[];
  readonly reasons: readonly string[];
  readonly parsedCommands: readonly ParsedCommand[];
}

interface ParsedLayer {
  readonly request: CommandCompactionRequest;
  readonly commands: readonly ParsedCommand[];
  readonly diagnostics: readonly CommandDiagnostic[];
}

interface SemanticTrace extends ParsedLayer {
  readonly finalStatData: Readonly<Record<string, unknown>>;
  readonly finalStatFunc: Readonly<Record<string, unknown>>;
  readonly diagnostics: readonly CommandDiagnostic[];
}

interface Candidate extends SemanticTrace {
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

function clone<T>(value: T): T {
  return structuredClone(value);
}

function equal(left: unknown, right: unknown): boolean {
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
): { readonly value?: number; readonly diagnostic?: CommandDiagnostic } {
  const request = {
    initialState: stat,
    snapshotState: layerStart,
    functionLibrary: statFunc,
    snapshotFunctionLibrary: startFunc,
    allowSnapshots: true,
    operations: [{ path: path.join("."), expr }],
  };
  const response = executeExpressionLayer(request);
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
): void {
  const current = getAt(stat, segments);
  if (segments.length > 0 && current === undefined) return;
  if (metaValue(current, "updatable") === false) {
    const unlock = plain(patch) && plain(patch.$meta) && patch.$meta.updatable === true;
    if (!unlock) return;
  }
  if (plain(patch) && Object.keys(patch).length === 1 && typeof patch.$expr === "string") {
    if (segments.length === 0 || !hasAt(stat, segments)) return;
    const resolved = expressionValue(stat, layerStart, statFunc, startFunc, segments, patch.$expr);
    if (resolved.diagnostic) diagnostics.push({ ...resolved.diagnostic, commandIndex });
    else setAt(stat, segments, resolved.value);
    return;
  }
  if (!plain(patch)) {
    if (segments.length > 0 && hasAt(stat, segments)) setAt(stat, segments, patch);
    return;
  }
  for (const [key, value] of Object.entries(patch)) {
    applyEditAt(stat, layerStart, statFunc, startFunc, [...segments, key], value, diagnostics, commandIndex);
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
  for (const command of parsed.commands) {
    if (command.data.length === 0) continue;
    if (command.kind === "insert") for (const patch of command.data) applyInsertAt(stat, [], patch);
    else if (command.kind === "edit") for (const patch of command.data) applyEditAt(stat, start, functions, startFunctions, [], patch, diagnostics, command.index);
    else if (command.kind === "delete") for (const patch of command.data) applyDeleteAt(stat, [], patch);
    else functions = applyFunction(functions, command.kind, command.data, diagnostics, command.index);
  }
  return { ...parsed, finalStatData: stat, finalStatFunc: functions, diagnostics };
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

function renderTag(tag: string, data: Record<string, unknown>): string {
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

function candidateFor(trace: SemanticTrace): Candidate {
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
      if (cursor === 0) replacement = compactEditRun(trace, run);
      else reasons.push(`${run.map((command) => command.tag).join("/")} 保留：前序命令会改变该区间的层起始语义。`);
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

function render(trace: SemanticTrace, replacements: ReadonlyMap<number, string>): string {
  let content = trace.request.content;
  for (const command of [...trace.commands].sort((left, right) => right.start - left.start)) {
    const replacement = replacements.get(command.index);
    if (replacement !== undefined) content = `${content.slice(0, command.start)}${replacement}${content.slice(command.end)}`;
  }
  return content;
}

function equivalent(trace: SemanticTrace, content: string): boolean {
  const replay = executeOriginalSemantics(parseCommandLayer({ ...trace.request, content }));
  const sameDiagnostics = replay.diagnostics.length === trace.diagnostics.length && replay.diagnostics.every((issue, index) => {
    const expected = trace.diagnostics[index];
    return expected !== undefined && issue.code === expected.code && issue.path === expected.path;
  });
  return sameDiagnostics && equal(replay.finalStatData, trace.finalStatData) && equal(replay.finalStatFunc, trace.finalStatFunc);
}

function compactBareCommandLayer(input: unknown): CommandCompactionResponse {
  const parsed = parseCommandLayer(input);
  const trace = executeOriginalSemantics(parsed);
  if (parsed.diagnostics.length > 0) return { status: "invalid", content: parsed.request.content, finalStatData: trace.finalStatData, finalStatFunc: trace.finalStatFunc, diagnostics: trace.diagnostics, reasons: ["标签 JSON 无效，未改写消息。"], parsedCommands: parsed.commands };
  const candidate = candidateFor(trace);
  if (candidate.replacements.size === 0) return { status: "unchanged", content: trace.request.content, finalStatData: trace.finalStatData, finalStatFunc: trace.finalStatFunc, diagnostics: trace.diagnostics, reasons: candidate.reasons.length ? candidate.reasons : ["没有可证明安全的缩写。"], parsedCommands: trace.commands };
  const content = render(trace, candidate.replacements);
  if (!equivalent(trace, content)) return { status: "unchanged", content: trace.request.content, finalStatData: trace.finalStatData, finalStatFunc: trace.finalStatFunc, diagnostics: trace.diagnostics, reasons: [...candidate.reasons, "候选未通过同一起点真实重放，已退回原命令。"], parsedCommands: trace.commands };
  const all = trace.commands.every((command) => candidate.replacements.has(command.index));
  return { status: all ? "compacted" : "partial", content, finalStatData: trace.finalStatData, finalStatFunc: trace.finalStatFunc, diagnostics: trace.diagnostics, reasons: candidate.reasons, parsedCommands: trace.commands };
}

interface ScopedTransaction {
  readonly start: number;
  readonly end: number;
  readonly raw: string;
  readonly body: string;
  readonly scope: "m" | "b" | "a" | null;
}

function scopedTransactions(content: string): readonly ScopedTransaction[] {
  const result: ScopedTransaction[] = [];
  const pattern = /<era_tx\b([^>]*)>([\s\S]*?)<\/era_tx>/giu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const scopeMatch = /\bs\s*=\s*["']([^"']+)["']/iu.exec(match[1] ?? "");
    const rawScope = scopeMatch?.[1] ?? "";
    result.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      body: match[2] ?? "",
      scope: rawScope === "m" || rawScope === "b" || rawScope === "a" ? rawScope : null,
    });
  }
  return result;
}

function withStartState(
  request: CommandCompactionRequest,
  content: string,
  statData: Readonly<Record<string, unknown>>,
  statFunc: Readonly<Record<string, unknown>>,
): CommandCompactionRequest {
  return { ...request, content, initialStatData: statData, initialStatFunc: statFunc };
}

/**
 * era_tx 的 scope 是不可跨越的语义边界。只有相邻、同 scope 且中间只有空白的
 * wrapper 才合并为一个候选；不同 scope、非法 wrapper 与普通正文均保留原顺序。
 */
export function compactCommandLayer(input: unknown): CommandCompactionResponse {
  const parsed = parseCommandLayer(input);
  const transactions = scopedTransactions(parsed.request.content);
  if (transactions.length === 0) return compactBareCommandLayer(parsed.request);

  let cursor = 0;
  let statData = clone(parsed.request.initialStatData);
  let statFunc = clone(parsed.request.initialStatFunc ?? {});
  let content = "";
  let changed = false;
  let commandSegments = 0;
  let rewrittenSegments = 0;
  const diagnostics: CommandDiagnostic[] = [];
  const reasons: string[] = [];

  const consume = (text: string, allowRewrite: boolean): string => {
    const result = compactBareCommandLayer(withStartState(parsed.request, text, statData, statFunc));
    statData = clone(result.finalStatData);
    statFunc = clone(result.finalStatFunc);
    diagnostics.push(...result.diagnostics);
    reasons.push(...result.reasons);
    if (result.parsedCommands.length > 0) {
      commandSegments += 1;
      if (allowRewrite && result.content !== text && result.diagnostics.length === 0) {
        rewrittenSegments += 1;
        changed = true;
        return result.content;
      }
    }
    return text;
  };

  for (let index = 0; index < transactions.length;) {
    const current = transactions[index]!;
    const prefix = parsed.request.content.slice(cursor, current.start);
    content += consume(prefix, true);

    if (current.scope === null) {
      consume(current.body, false);
      content += current.raw;
      cursor = current.end;
      index += 1;
      continue;
    }

    let endIndex = index;
    let combinedBody = current.body;
    let rawGroup = current.raw;
    while (endIndex + 1 < transactions.length) {
      const next = transactions[endIndex + 1]!;
      const between = parsed.request.content.slice(transactions[endIndex]!.end, next.start);
      if (next.scope !== current.scope || between.trim().length > 0) break;
      combinedBody += `${between}${next.body}`;
      rawGroup += `${between}${next.raw}`;
      endIndex += 1;
    }

    // 单个事务不是 API 分段压缩目标；避免只因规范化空白或改写为 @path
    // 而制造无收益的消息变更。只有至少两个相邻同 scope 事务才允许合并。
    const compactedBody = consume(combinedBody, endIndex > index);
    if (compactedBody !== combinedBody) {
      content += `<era_tx s="${current.scope}">${compactedBody}</era_tx>`;
    } else {
      content += rawGroup;
    }
    cursor = transactions[endIndex]!.end;
    index = endIndex + 1;
  }

  content += consume(parsed.request.content.slice(cursor), true);
  const originalTrace = executeOriginalSemantics(parsed);
  const replay = executeOriginalSemantics(parseCommandLayer({ ...parsed.request, content }));
  const equivalentResult = equal(originalTrace.finalStatData, replay.finalStatData) &&
    equal(originalTrace.finalStatFunc, replay.finalStatFunc) &&
    originalTrace.diagnostics.length === replay.diagnostics.length &&
    originalTrace.diagnostics.every((issue, index) => issue.code === replay.diagnostics[index]?.code && issue.path === replay.diagnostics[index]?.path);
  if (!changed || !equivalentResult) {
    return {
      status: diagnostics.length > 0 ? "invalid" : "unchanged",
      content: parsed.request.content,
      finalStatData: originalTrace.finalStatData,
      finalStatFunc: originalTrace.finalStatFunc,
      diagnostics: originalTrace.diagnostics,
      reasons: equivalentResult ? reasons : [...reasons, "同 scope 分段候选未通过整层真实重放，已保留原事务。"],
      parsedCommands: parsed.commands,
    };
  }
  return {
    status: rewrittenSegments === commandSegments ? "compacted" : "partial",
    content,
    finalStatData: originalTrace.finalStatData,
    finalStatFunc: originalTrace.finalStatFunc,
    diagnostics: originalTrace.diagnostics,
    reasons,
    parsedCommands: parsed.commands,
  };
}

type Inputs = any;
function input<T>(inputs: Inputs, key: string): T {
  const value = inputs[key];
  return value !== null && typeof value === "object" && "value" in value ? (value as { value: T }).value : value as T;
}

export function parseCommandBlocksNode(inputs: any): any { return { parsed: parseCommandLayer(input(inputs, "era.command_compaction.request")) }; }
export function executeOriginalSemanticsNode(inputs: any): any { return { trace: executeOriginalSemantics(input(inputs, "era.command_compaction.parsed")) }; }
export function deriveReplayInvariantsNode(inputs: any): any { const trace = input<SemanticTrace>(inputs, "era.command_compaction.semantic_trace"); return { invariants: { trace, conservative: true } }; }
export function partitionSafeRegionsNode(inputs: any): any { const invariants = input<{ trace: SemanticTrace }>(inputs, "era.command_compaction.invariants"); return { regions: { ...invariants, regions: invariants.trace.commands.map((command) => ({ index: command.index, kind: command.kind })) } }; }
export function symbolizeDependenciesNode(inputs: any): any { return { symbols: input(inputs, "era.command_compaction.regions") }; }
export function rewriteSafeRegionsNode(inputs: any): any { const payload = input<{ trace: SemanticTrace }>(inputs, "era.command_compaction.symbols"); return { candidate: candidateFor(payload.trace) }; }
export function verifyReplayEquivalenceNode(inputs: any): any { const candidate = input<Candidate>(inputs, "era.command_compaction.candidate"); const content = render(candidate, candidate.replacements); return { verified: { candidate, content, equivalent: equivalent(candidate, content) } }; }
export function renderCompactionResultNode(inputs: any): any { const verified = input<{ candidate: Candidate; content: string; equivalent: boolean }>(inputs, "era.command_compaction.verified"); return { compaction_response: verified.equivalent ? compactCommandLayer(verified.candidate.request) : compactCommandLayer({ ...verified.candidate.request, content: verified.candidate.request.content }) }; }
export function terminalNode(): any { return {}; }
