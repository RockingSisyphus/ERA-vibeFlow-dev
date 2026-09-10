import {
  NormalizedRequest,
  ParsedFunction,
  Diagnostic,
  CompiledLibrary,
  Ast,
} from "./expression_types.ts";
import { isRecord, diagnostic, isBuiltin } from "./expression_primitives.ts";
import { parseExpression, walk } from "./expression_syntax.ts";

export function parseFunctionDefinitions(
  request: NormalizedRequest,
): readonly ParsedFunction[] {
  const parsed: ParsedFunction[] = [];
  for (const [name, raw] of Object.entries(request.functionLibrary)) {
    // Service-owned function metadata (for example `$meta.updatable`) travels with a
    // definition in Sidecar, but it must never become expression grammar or evaluation
    // input.  Project only the mathematical definition at this cross-root boundary.
    const definition = isRecord(raw)
      ? { params: raw.params, expr: raw.expr }
      : raw;
    const diagnostics: Diagnostic[] = [];
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name))
      diagnostics.push(
        diagnostic(
          "ERA_EXPR_FUNCTION_NAME",
          `函数名 ${JSON.stringify(name)} 无效。`,
          { path: name },
        ),
      );
    if (isBuiltin(name))
      diagnostics.push(
        diagnostic(
          "ERA_EXPR_FUNCTION_NAME_CONFLICT",
          `函数名 ${name} 与内建函数冲突。`,
          { path: name },
        ),
      );
    if (
      !isRecord(definition) ||
      !Array.isArray(definition.params) ||
      typeof definition.expr !== "string"
    )
      diagnostics.push(
        diagnostic(
          "ERA_EXPR_FUNCTION_SHAPE",
          `函数 ${name} 应包含 params 数组与 expr 字符串。`,
          { path: name },
        ),
      );
    const params =
      isRecord(definition) && Array.isArray(definition.params)
        ? definition.params.filter(
            (item): item is string => typeof item === "string",
          )
        : [];
    if (
      params.length !== new Set(params).size ||
      params.some((param) => !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(param))
    )
      diagnostics.push(
        diagnostic(
          "ERA_EXPR_FUNCTION_PARAMS",
          `函数 ${name} 的形参必须是互异标识符。`,
          { path: name },
        ),
      );
    const expr =
      isRecord(definition) && typeof definition.expr === "string"
        ? definition.expr
        : "";
    const result =
      diagnostics.length === 0
        ? parseExpression(expr, false)
        : { ast: null, diagnostics: [] as readonly Diagnostic[] };
    parsed.push({
      name,
      params,
      expr,
      ast: result.ast,
      diagnostics: [...diagnostics, ...result.diagnostics],
    });
  }
  return parsed;
}

export function extractFunctionDependencies(
  parsed: readonly ParsedFunction[],
): Readonly<Record<string, readonly string[]>> {
  const names = new Set(parsed.map((item) => item.name));
  const result: Record<string, readonly string[]> = {};
  for (const functionDef of parsed) {
    const dependencies = new Set<string>();
    if (functionDef.ast)
      walk(functionDef.ast, (item) => {
        if (item.kind === "call" && names.has(item.name))
          dependencies.add(item.name);
      });
    result[functionDef.name] = [...dependencies].sort();
  }
  return result;
}

export function validateFunctionPurity(
  parsed: readonly ParsedFunction[],
): readonly Diagnostic[] {
  const functions = new Map(parsed.map((item) => [item.name, item]));
  const diagnostics: Diagnostic[] = [];
  for (const functionDef of parsed) {
    diagnostics.push(...functionDef.diagnostics);
    if (!functionDef.ast) continue;
    const params = new Set(functionDef.params);
    walk(functionDef.ast, (item) => {
      if (
        item.kind === "ref" &&
        (!params.has(item.path[0]!) || item.path.length !== 1 || item.snapshot)
      )
        diagnostics.push(
          diagnostic(
            "ERA_EXPR_FUNCTION_IMPURE",
            `函数 ${functionDef.name} 只能读取自己的形参。`,
            { path: functionDef.name },
          ),
        );
      if (item.kind === "call") {
        if (item.name === "random" && item.args.length > 2)
          diagnostics.push(
            diagnostic(
              "ERA_EXPR_BUILTIN_ARITY",
              `函数 ${functionDef.name} 中的 random 只接受零个、一个或两个参数。`,
              { path: functionDef.name },
            ),
          );
        if (!isBuiltin(item.name) && !functions.has(item.name))
          diagnostics.push(
            diagnostic(
              "ERA_EXPR_FUNCTION_UNKNOWN_CALL",
              `函数 ${functionDef.name} 调用了未知函数 ${item.name}。`,
              { path: functionDef.name },
            ),
          );
        const target = functions.get(item.name);
        if (target && item.args.length !== target.params.length)
          diagnostics.push(
            diagnostic(
              "ERA_EXPR_FUNCTION_ARITY",
              `函数 ${functionDef.name} 调用 ${item.name} 的实参数不匹配。`,
              { path: functionDef.name },
            ),
          );
      }
    });
  }
  return diagnostics;
}

export function rejectRecursiveFunctions(
  dependencies: Readonly<Record<string, readonly string[]>>,
): readonly Diagnostic[] {
  const visited = new Set<string>();
  const visiting: string[] = [];
  const diagnostics: Diagnostic[] = [];
  const visit = (name: string): void => {
    const existing = visiting.indexOf(name);
    if (existing >= 0) {
      diagnostics.push(
        diagnostic(
          "ERA_EXPR_FUNCTION_RECURSION",
          `函数递归不被支持：${[...visiting.slice(existing), name].join(" → ")}。`,
          { path: name },
        ),
      );
      return;
    }
    if (visited.has(name)) return;
    visiting.push(name);
    for (const dependency of dependencies[name] ?? []) visit(dependency);
    visiting.pop();
    visited.add(name);
  };
  for (const name of Object.keys(dependencies)) visit(name);
  return diagnostics;
}

export function findRandomFunctions(
  parsed: readonly ParsedFunction[],
): readonly string[] {
  const functions = new Map(parsed.map((item) => [item.name, item]));
  const memo = new Map<string, boolean>();
  const visiting = new Set<string>();
  const contains = (name: string): boolean => {
    const cached = memo.get(name);
    if (cached !== undefined) return cached;
    if (visiting.has(name)) return false;
    visiting.add(name);
    const definition = functions.get(name);
    let found = false;
    if (definition?.ast)
      walk(definition.ast, (item) => {
        if (item.kind !== "call" || found) return;
        if (item.name === "random") found = true;
        else if (functions.has(item.name) && contains(item.name)) found = true;
      });
    visiting.delete(name);
    memo.set(name, found);
    return found;
  };
  return [...functions.keys()].filter(contains).sort();
}

export function compileCallableFunctions(
  parsed: readonly ParsedFunction[],
  diagnostics: readonly Diagnostic[],
): CompiledLibrary {
  const all = [...diagnostics];
  return {
    functions: Object.fromEntries(
      parsed
        .filter((item) => item.ast !== null)
        .map((item) => [item.name, item]),
    ),
    randomFunctions: findRandomFunctions(parsed),
    diagnostics: all,
    valid: all.length === 0,
  };
}

export function compileFunctionLibrary(
  functionLibrary: Readonly<Record<string, unknown>>,
): CompiledLibrary {
  const request: NormalizedRequest = {
    initialState: {},
    snapshotState: null,
    functionLibrary,
    snapshotFunctionLibrary: null,
    allowSnapshots: false,
    randomContext: null,
    operations: [],
    diagnostics: [],
    valid: true,
  };
  const parsed = parseFunctionDefinitions(request);
  const dependencies = extractFunctionDependencies(parsed);
  return compileCallableFunctions(parsed, [
    ...validateFunctionPurity(parsed),
    ...rejectRecursiveFunctions(dependencies),
  ]);
}

export function countAutomaticRandomDraws(
  ast: Ast,
  currentLibrary: CompiledLibrary,
  snapshotLibrary: CompiledLibrary = currentLibrary,
): number {
  const visiting = new Set<ParsedFunction>();
  const count = (item: Ast, library: CompiledLibrary): number => {
    if (item.kind === "literal" || item.kind === "ref") return 0;
    if (item.kind === "unary") return count(item.value, library);
    if (item.kind === "binary")
      return count(item.left, library) + count(item.right, library);
    let total = item.args.reduce((sum, arg) => sum + count(arg, library), 0);
    if (item.name === "random") return total + (item.args.length < 2 ? 1 : 0);
    if (isBuiltin(item.name)) return total;
    const targetLibrary = item.snapshot ? snapshotLibrary : library;
    const target = targetLibrary.functions[item.name];
    if (target?.ast && !visiting.has(target)) {
      visiting.add(target);
      total += count(target.ast, targetLibrary);
      visiting.delete(target);
    }
    return total;
  };
  return count(ast, currentLibrary);
}

export function containsAnyRandomCall(
  ast: Ast,
  currentLibrary: CompiledLibrary,
  snapshotLibrary: CompiledLibrary = currentLibrary,
): boolean {
  const visiting = new Set<ParsedFunction>();
  const visit = (item: Ast, library: CompiledLibrary): boolean => {
    if (item.kind === "literal" || item.kind === "ref") return false;
    if (item.kind === "unary") return visit(item.value, library);
    if (item.kind === "binary")
      return visit(item.left, library) || visit(item.right, library);
    if (item.args.some((arg) => visit(arg, library))) return true;
    if (item.name === "random") return true;
    if (isBuiltin(item.name)) return false;
    const targetLibrary = item.snapshot ? snapshotLibrary : library;
    const target = targetLibrary.functions[item.name];
    if (!target?.ast || visiting.has(target)) return false;
    visiting.add(target);
    const found = visit(target.ast, targetLibrary);
    visiting.delete(target);
    return found;
  };
  return visit(ast, currentLibrary);
}
