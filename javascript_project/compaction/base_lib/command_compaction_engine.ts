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

import { plain, clone, equal, parseCommandLayer, applyInsertAt, applyEditAt, applyDeleteAt, applyFunction, type CommandDiagnostic, type ParsedCommand, type ParsedLayer, type SemanticTrace, type Candidate } from "./command_compaction_interpreter.ts";
export * from "./command_compaction_interpreter.ts";

function replayCommand(command: ParsedCommand, state: {
  readonly stat: Record<string, unknown>;
  readonly start: Record<string, unknown>;
  readonly functions: Record<string, unknown>;
  readonly startFunctions: Record<string, unknown>;
  readonly diagnostics: CommandDiagnostic[];
  readonly randomCursor: { sourceKey: string; drawOffset: number } | null;
}): Record<string, unknown> {
  if (command.kind === "insert") {
    for (const patch of command.data) applyInsertAt(state.stat, [], patch);
  } else if (command.kind === "edit") {
    for (const patch of command.data) applyEditAt(state.stat, state.start, state.functions, state.startFunctions, [], patch, state.diagnostics, command.index, state.randomCursor);
  } else if (command.kind === "delete") {
    for (const patch of command.data) applyDeleteAt(state.stat, [], patch);
  } else {
    return applyFunction(state.functions, command.kind, command.data, state.diagnostics, command.index);
  }
  return state.functions;
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
    functions = replayCommand(command, { stat, start, functions, startFunctions, diagnostics, randomCursor });
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
    if (!Object.prototype.hasOwnProperty.call(output, key)) {
      output[key] = clone(value);
      continue;
    }
    // Existing leaves are intentionally first-wins: the second strict Insert is a no-op.
    if (!plain(value)) continue;
    if (!plain(output[key])) {
      // If the earlier Insert created a primitive, a later object patch can still
      // matter when an edited earlier layer makes the pre-existing value an object.
      return null;
    }
    const merged = mergeInsertPatch(output[key], value);
    if (merged === null) return null;
    output[key] = merged;
  }
  return output;
}

function allCommandData(command: ParsedCommand): Record<string, unknown> | null {
  if (command.data.length !== 1) return null;
  return command.data[0] ?? null;
}

type NumericEdit = { readonly path: string; readonly expr: string; readonly source: "expr" | "literal"; readonly literal?: number };

function renderCompactedEdits(
  operations: readonly NumericEdit[],
  compacted: readonly { readonly path: string; readonly value: { readonly $expr: string } }[],
): string | null {
  const sourceByPath = new Map<string, "expr" | "literal" | "mixed">();
  const lastLiteralByPath = new Map<string, number>();
  for (const operation of operations) {
    const prior = sourceByPath.get(operation.path);
    sourceByPath.set(operation.path, prior === undefined || prior === operation.source ? operation.source : "mixed");
    if (operation.source === "literal") lastLiteralByPath.set(operation.path, operation.literal!);
  }
  if ([...sourceByPath.values()].includes("mixed")) return null;
  const output = nestingRecord(compacted.map((item) => {
    const source = sourceByPath.get(item.path);
    return source === "literal"
      ? { path: item.path, value: lastLiteralByPath.get(item.path)! }
      : { path: item.path, value: { $expr: item.value.$expr } };
  }));
  return output && Object.keys(output).length > 0 ? renderTag("VariableEdit", output) : "";
}

function compactEditRun(trace: SemanticTrace, commands: readonly ParsedCommand[]): string | null {
  const operations: NumericEdit[] = [];
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
  return renderCompactedEdits(operations, response.compactedOperations);
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
