import { NormalizedRequest, CompiledLibrary, ParsedOperation, SequenceState, Ast, AstFrameState } from "./expression_types.ts";
import { clone, ExpressionFailure, diagnostic, getPath, isBuiltin } from "./expression_primitives.ts";
export function initializeSequenceState(
  request: NormalizedRequest,
  compiled: CompiledLibrary,
  operations: readonly ParsedOperation[],
  snapshotCompiled: CompiledLibrary = compiled,
): SequenceState {
  return {
    startState: clone(request.snapshotState ?? request.initialState),
    currentState: clone(request.initialState),
    compiled,
    snapshotCompiled,
    operations,
    cursor: 0,
    randomContext: request.randomContext,
    randomDrawsConsumed: 0,
    diagnostics: [...request.diagnostics, ...compiled.diagnostics],
  };
}

export function refValue(
  ast: Extract<Ast, { kind: "ref" }>,
  state: SequenceState,
  env: Readonly<Record<string, number>>,
  allowState: boolean,
): number {
  if (ast.path.length === 1 && ast.path[0]! in env) return env[ast.path[0]!]!;
  if (!allowState)
    throw new ExpressionFailure(
      diagnostic("ERA_EXPR_FUNCTION_IMPURE", "函数体不能读取外部变量状态。", {
        path: ast.path.join("."),
      }),
    );
  const source = ast.snapshot ? state.startState : state.currentState;
  const value = getPath(source, ast.path);
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_REFERENCE_NON_NUMERIC",
        `变量 ${ast.path.join(".")} 必须已定义为有限数字。`,
        { path: ast.path.join(".") },
      ),
    );
  return value;
}

export function popValues(
  values: readonly number[],
  count: number,
): { readonly values: readonly number[]; readonly args: readonly number[] } {
  if (count === 0) return { values, args: [] };
  if (values.length < count)
    throw new ExpressionFailure(
      diagnostic("ERA_EXPR_EVALUATION_STACK", "表达式求值栈缺少子表达式结果。"),
    );
  return { values: values.slice(0, -count), args: values.slice(-count) };
}

export function inlineCustomAst(
  ast: Ast,
  bindings: Readonly<Record<string, Ast>>,
  library: CompiledLibrary,
): Ast {
  if (ast.kind === "literal") return ast;
  if (ast.kind === "ref") return bindings[ast.path.join(".")] ?? ast;
  if (ast.kind === "unary")
    return { ...ast, value: inlineCustomAst(ast.value, bindings, library) };
  if (ast.kind === "binary")
    return {
      ...ast,
      left: inlineCustomAst(ast.left, bindings, library),
      right: inlineCustomAst(ast.right, bindings, library),
    };
  const target = library.functions[ast.name];
  const args = ast.args.map((arg) => inlineCustomAst(arg, bindings, library));
  if (!target || !target.ast)
    return { kind: "call", name: ast.name, args, snapshot: ast.snapshot };
  const childBindings = Object.fromEntries(
    target.params.map((param, index) => [param, args[index]!]),
  ) as Record<string, Ast>;
  return inlineCustomAst(target.ast, childBindings, library);
}

export function mathText(ast: Ast): string {
  if (ast.kind === "literal")
    return Number.isInteger(ast.value) ? `${ast.value}` : `${ast.value}`;
  if (ast.kind === "ref") return ast.path.join("_");
  if (ast.kind === "unary") return `(${ast.op}${mathText(ast.value)})`;
  if (ast.kind === "binary")
    return `(${mathText(ast.left)} ${ast.op} ${mathText(ast.right)})`;
  const names: Readonly<Record<string, string>> = {
    ln: "log",
    pow: "pow",
    mod: "mod",
  };
  return `${names[ast.name] ?? ast.name}(${ast.args.map(mathText).join(",")})`;
}

export function createAstFrameState(
  sequence: SequenceState,
  ast: Ast,
  env: Readonly<Record<string, number>> = {},
  allowState = true,
  library: CompiledLibrary = sequence.compiled,
): AstFrameState {
  return {
    sequence,
    stack: [{ kind: "eval", ast, env, allowState, library }],
    values: [],
    automaticRandomDrawCursor:
      (sequence.randomContext?.drawOffset ?? 0) + sequence.randomDrawsConsumed,
    done: false,
    result: null,
    diagnostics: [],
  };
}

export function complete(
  state: Omit<AstFrameState, "done" | "result">,
): AstFrameState {
  if (state.stack.length === 0 && state.values.length === 1)
    return { ...state, done: true, result: state.values[0]! };
  return { ...state, done: false, result: null };
}

export function astFrameRoute(
  state: AstFrameState,
): "value" | "operator" | "builtin" | "random" | "custom" | "return" {
  const top = state.stack[state.stack.length - 1];
  if (!top) return "return";
  if (top.kind === "eval") {
    if (top.ast.kind === "literal" || top.ast.kind === "ref") return "value";
    if (top.ast.kind === "unary" || top.ast.kind === "binary")
      return "operator";
    if (top.ast.name === "random") return "random";
    if (isBuiltin(top.ast.name)) return "builtin";
    return "custom";
  }
  if (top.kind === "unary" || top.kind === "binary") return "operator";
  if (top.kind === "builtin" || top.kind === "calculus") return "builtin";
  if (top.kind === "random") return "random";
  if (top.kind === "custom") return "custom";
  return "return";
}
