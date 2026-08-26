import gamma from "@stdlib/math-base-special-gamma";
// ERA 仅接受有限 JavaScript 数值；number-only entry 保留符号导数与
// 安全求值，同时不把矩阵、复数或任意精度数学体系带入浏览器 bundle。
import { derivative, evaluate as mathEvaluate } from "mathjs/number";

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly position?: number;
}

export type Ast =
  | { readonly kind: "literal"; readonly value: number }
  | {
      readonly kind: "ref";
      readonly path: readonly string[];
      readonly snapshot: boolean;
    }
  | { readonly kind: "unary"; readonly op: "+" | "-"; readonly value: Ast }
  | {
      readonly kind: "binary";
      readonly op: "+" | "-" | "*" | "/" | "%" | "^";
      readonly left: Ast;
      readonly right: Ast;
    }
  | {
      readonly kind: "call";
      readonly name: string;
      readonly args: readonly Ast[];
      /** `@f(...)` binds this whole custom-call closure to the layer snapshot. */
      readonly snapshot?: boolean;
    };

export interface ParsedFunction {
  readonly name: string;
  readonly params: readonly string[];
  readonly expr: string;
  readonly ast: Ast | null;
  readonly diagnostics: readonly Diagnostic[];
}

export interface CompiledLibrary {
  readonly functions: Readonly<Record<string, ParsedFunction>>;
  /** Custom functions that directly or transitively contain any random call. */
  readonly randomFunctions: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
  readonly valid: boolean;
}

export interface RandomContext {
  /** Stable message identity. ERA Service passes the message MK. */
  readonly sourceKey: string;
  /** First automatic draw index available to this request. */
  readonly drawOffset: number;
}

export interface ParsedOperation {
  readonly index: number;
  readonly path: readonly string[];
  readonly expr: string;
  readonly ast: Ast | null;
  readonly diagnostics: readonly Diagnostic[];
}

export interface NormalizedRequest {
  readonly initialState: JsonValue;
  readonly snapshotState: JsonValue | null;
  readonly functionLibrary: Readonly<Record<string, unknown>>;
  readonly snapshotFunctionLibrary: Readonly<Record<string, unknown>> | null;
  readonly allowSnapshots: boolean;
  readonly randomContext: RandomContext | null;
  readonly operations: readonly {
    readonly path: string;
    readonly expr: string;
  }[];
  readonly diagnostics: readonly Diagnostic[];
  readonly valid: boolean;
}

export interface SequenceState {
  readonly startState: JsonValue;
  readonly currentState: JsonValue;
  readonly compiled: CompiledLibrary;
  readonly snapshotCompiled: CompiledLibrary;
  readonly operations: readonly ParsedOperation[];
  readonly cursor: number;
  readonly randomContext: RandomContext | null;
  /** Statically reserved automatic draws, including failed runtime operations. */
  readonly randomDrawsConsumed: number;
  readonly diagnostics: readonly Diagnostic[];
}

export interface ExpressionResponse {
  readonly status: "ok" | "invalid" | "partial";
  readonly finalState: JsonValue;
  readonly diagnostics: readonly Diagnostic[];
  readonly compressed: Readonly<Record<string, { readonly $expr: string }>>;
  readonly compactedOperations: readonly {
    readonly path: string;
    readonly value: { readonly $expr: string };
  }[];
  readonly randomDrawsConsumed: number;
  readonly nextDrawOffset: number;
  readonly containsAutomaticRandom: boolean;
}

interface Token {
  readonly kind: "number" | "identifier" | "operator" | "punctuation" | "eof";
  readonly text: string;
  readonly position: number;
}

function isBuiltin(name: string): boolean {
  return [
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "sinh",
    "cosh",
    "tanh",
    "asinh",
    "acosh",
    "atanh",
    "exp",
    "log",
    "ln",
    "sqrt",
    "abs",
    "floor",
    "ceil",
    "round",
    "trunc",
    "min",
    "max",
    "clamp",
    "pow",
    "mod",
    "factorial",
    "gamma",
    "derivative",
    "integral",
    "random"
  ].includes(name);
}

function diagnostic(
  code: string,
  message: string,
  extra: Partial<Diagnostic> = {}
): Diagnostic {
  return { code, message, ...extra };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone<T extends JsonValue>(value: T): T {
  return structuredClone(value);
}

function finite(value: number, code: string, message: string): number {
  if (!Number.isFinite(value))
    throw new ExpressionFailure(diagnostic(code, message));
  return Object.is(value, -0) ? 0 : value;
}

class ExpressionFailure extends Error {
  constructor(readonly detail: Diagnostic) {
    super(detail.message);
  }
}

function lex(source: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const char = source[cursor]!;
    if (/\s/u.test(char)) {
      cursor += 1;
      continue;
    }
    if (
      /[0-9.]/u.test(char) &&
      (/[0-9]/u.test(char) || /[0-9]/u.test(source[cursor + 1] ?? ""))
    ) {
      const match = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/u.exec(
        source.slice(cursor)
      );
      if (!match)
        throw new ExpressionFailure(
          diagnostic("ERA_EXPR_LEX_INVALID_NUMBER", "无效数字。", {
            position: cursor
          })
        );
      tokens.push({ kind: "number", text: match[0], position: cursor });
      cursor += match[0].length;
      continue;
    }
    if (/[A-Za-z_]/u.test(char)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/u.exec(source.slice(cursor))!;
      tokens.push({ kind: "identifier", text: match[0], position: cursor });
      cursor += match[0].length;
      continue;
    }
    if ("+-*/%^@".includes(char)) {
      tokens.push({ kind: "operator", text: char, position: cursor });
      cursor += 1;
      continue;
    }
    if ("(),.".includes(char)) {
      tokens.push({ kind: "punctuation", text: char, position: cursor });
      cursor += 1;
      continue;
    }
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_LEX_INVALID_CHARACTER",
        `不支持字符 ${JSON.stringify(char)}。`,
        { position: cursor }
      )
    );
  }
  tokens.push({ kind: "eof", text: "", position: cursor });
  return tokens;
}

class Parser {
  private index = 0;
  constructor(
    private readonly tokens: readonly Token[],
    private readonly allowSnapshot: boolean
  ) {}
  private current(): Token {
    return this.tokens[this.index]!;
  }
  private take(): Token {
    return this.tokens[this.index++]!;
  }
  private matches(text: string): boolean {
    return this.current().text === text;
  }
  private expect(text: string): Token {
    if (!this.matches(text))
      throw new ExpressionFailure(
        diagnostic("ERA_EXPR_PARSE_EXPECTED", `此处应为 ${text}。`, {
          position: this.current().position
        })
      );
    return this.take();
  }
  parse(): Ast {
    const ast = this.additive();
    if (this.current().kind !== "eof")
      throw new ExpressionFailure(
        diagnostic("ERA_EXPR_PARSE_TRAILING", "表达式末尾存在未解析内容。", {
          position: this.current().position
        })
      );
    return ast;
  }
  private additive(): Ast {
    let left = this.multiplicative();
    while (this.matches("+") || this.matches("-")) {
      const op = this.take().text as "+" | "-";
      left = { kind: "binary", op, left, right: this.multiplicative() };
    }
    return left;
  }
  private multiplicative(): Ast {
    let left = this.unary();
    while (this.matches("*") || this.matches("/") || this.matches("%")) {
      const op = this.take().text as "*" | "/" | "%";
      left = { kind: "binary", op, left, right: this.unary() };
    }
    return left;
  }
  private unary(): Ast {
    if (this.matches("+") || this.matches("-")) {
      const op = this.take().text as "+" | "-";
      return { kind: "unary", op, value: this.unary() };
    }
    return this.power();
  }
  private power(): Ast {
    const left = this.primary();
    if (this.matches("^")) {
      this.take();
      return { kind: "binary", op: "^", left, right: this.unary() };
    }
    return left;
  }
  private primary(): Ast {
    if (this.matches("(")) {
      this.take();
      const ast = this.additive();
      this.expect(")");
      return ast;
    }
    if (this.current().kind === "number") {
      const token = this.take();
      return {
        kind: "literal",
        value: finite(
          Number(token.text),
          "ERA_EXPR_NUMBER_NON_FINITE",
          "数字必须有限。"
        )
      };
    }
    let snapshot = false;
    if (this.matches("@")) {
      if (!this.allowSnapshot)
        throw new ExpressionFailure(
          diagnostic(
            "ERA_EXPR_SNAPSHOT_FORBIDDEN",
            "用户原始表达式不能使用 @path。",
            { position: this.current().position }
          )
        );
      this.take();
      snapshot = true;
    }
    if (this.current().kind !== "identifier")
      throw new ExpressionFailure(
        diagnostic("ERA_EXPR_PARSE_PRIMARY", "此处应为数字、变量或函数调用。", {
          position: this.current().position
        })
      );
    const first = this.take();
    if (this.matches("(")) {
      this.take();
      const args: Ast[] = [];
      if (!this.matches(")")) {
        do {
          args.push(this.additive());
          if (!this.matches(",")) break;
          this.take();
        } while (true);
      }
      this.expect(")");
      return { kind: "call", name: first.text, args, snapshot };
    }
    const path = [first.text];
    while (this.matches(".")) {
      this.take();
      const segment = this.current();
      if (segment.kind !== "identifier")
        throw new ExpressionFailure(
          diagnostic("ERA_EXPR_PATH_SEGMENT", "路径点号后应为标识符。", {
            position: segment.position
          })
        );
      path.push(this.take().text);
    }
    return { kind: "ref", path, snapshot };
  }
}

export function parseExpression(
  source: string,
  allowSnapshot = false
): { readonly ast: Ast | null; readonly diagnostics: readonly Diagnostic[] } {
  try {
    return {
      ast: new Parser(lex(source), allowSnapshot).parse(),
      diagnostics: []
    };
  } catch (error) {
    return {
      ast: null,
      diagnostics: [
        error instanceof ExpressionFailure
          ? error.detail
          : diagnostic("ERA_EXPR_PARSE_FAILED", String(error))
      ]
    };
  }
}

function validatePath(value: string): readonly string[] {
  const parts = value.split(".");
  if (
    parts.length === 0 ||
    parts.some((part) => !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(part))
  )
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_PATH_INVALID",
        `无效变量路径 ${JSON.stringify(value)}。`,
        { path: value }
      )
    );
  return parts;
}

function getPath(
  root: JsonValue,
  path: readonly string[]
): JsonValue | undefined {
  let value: JsonValue | undefined = root;
  for (const segment of path) {
    if (!isRecord(value) || !(segment in value)) return undefined;
    value = value[segment] as JsonValue;
  }
  return value;
}

function setPath(
  root: JsonValue,
  path: readonly string[],
  value: JsonValue
): JsonValue {
  if (!isRecord(root))
    throw new ExpressionFailure(
      diagnostic("ERA_EXPR_STATE_ROOT", "变量状态根必须是对象。")
    );
  const next = clone(root);
  let cursor: Record<string, JsonValue> = next;
  for (const segment of path.slice(0, -1)) {
    const child = cursor[segment];
    if (!isRecord(child)) cursor[segment] = {};
    cursor = cursor[segment] as Record<string, JsonValue>;
  }
  cursor[path[path.length - 1]!] = value;
  return next;
}

export function normaliseRequest(input: unknown): NormalizedRequest {
  const diagnostics: Diagnostic[] = [];
  const request = isRecord(input) ? input : {};
  const initialState = request.initialState;
  if (!isRecord(initialState))
    diagnostics.push(
      diagnostic(
        "ERA_EXPR_INITIAL_STATE_INVALID",
        "initialState 必须是 JSON 对象。"
      )
    );
  const snapshotState =
    request.snapshotState === undefined
      ? null
      : isRecord(request.snapshotState)
        ? clone(request.snapshotState as JsonValue)
        : null;
  if (request.snapshotState !== undefined && !isRecord(request.snapshotState))
    diagnostics.push(
      diagnostic(
        "ERA_EXPR_SNAPSHOT_STATE_INVALID",
        "snapshotState 必须是 JSON 对象。"
      )
    );
  const functionLibrary = isRecord(request.functionLibrary)
    ? request.functionLibrary
    : {};
  if (
    request.functionLibrary !== undefined &&
    !isRecord(request.functionLibrary)
  )
    diagnostics.push(
      diagnostic("ERA_EXPR_LIBRARY_INVALID", "functionLibrary 必须是对象。")
    );
  const snapshotFunctionLibrary =
    request.snapshotFunctionLibrary === undefined
      ? null
      : isRecord(request.snapshotFunctionLibrary)
        ? request.snapshotFunctionLibrary
        : null;
  if (
    request.snapshotFunctionLibrary !== undefined &&
    !isRecord(request.snapshotFunctionLibrary)
  )
    diagnostics.push(
      diagnostic(
        "ERA_EXPR_SNAPSHOT_LIBRARY_INVALID",
        "snapshotFunctionLibrary 必须是对象。"
      )
    );
  let randomContext: RandomContext | null = null;
  if (request.randomContext !== undefined) {
    if (
      !isRecord(request.randomContext) ||
      typeof request.randomContext.sourceKey !== "string" ||
      request.randomContext.sourceKey.length === 0 ||
      !Number.isSafeInteger(request.randomContext.drawOffset) ||
      (request.randomContext.drawOffset as number) < 0
    )
      diagnostics.push(
        diagnostic(
          "ERA_EXPR_RANDOM_CONTEXT_INVALID",
          "randomContext 需要非空 sourceKey 与非负安全整数 drawOffset。"
        )
      );
    else
      randomContext = {
        sourceKey: request.randomContext.sourceKey,
        drawOffset: request.randomContext.drawOffset as number
      };
  }
  const rawOperations = Array.isArray(request.operations)
    ? request.operations
    : [];
  if (!Array.isArray(request.operations))
    diagnostics.push(
      diagnostic("ERA_EXPR_OPERATIONS_INVALID", "operations 必须是有序数组。")
    );
  const operations: { path: string; expr: string }[] = [];
  for (const [index, operation] of rawOperations.entries()) {
    if (
      !isRecord(operation) ||
      typeof operation.path !== "string" ||
      typeof operation.expr !== "string"
    ) {
      diagnostics.push(
        diagnostic(
          "ERA_EXPR_OPERATION_SHAPE",
          `operations[${index}] 必须有 path 和 expr 字符串。`
        )
      );
      continue;
    }
    operations.push({ path: operation.path, expr: operation.expr });
  }
  return {
    initialState: isRecord(initialState)
      ? clone(initialState as JsonValue)
      : {},
    snapshotState,
    functionLibrary,
    snapshotFunctionLibrary,
    allowSnapshots: request.allowSnapshots === true,
    randomContext,
    operations,
    diagnostics,
    valid: diagnostics.length === 0
  };
}

export function parseFunctionDefinitions(
  request: NormalizedRequest
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
          { path: name }
        )
      );
    if (isBuiltin(name))
      diagnostics.push(
        diagnostic(
          "ERA_EXPR_FUNCTION_NAME_CONFLICT",
          `函数名 ${name} 与内建函数冲突。`,
          { path: name }
        )
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
          { path: name }
        )
      );
    const params =
      isRecord(definition) && Array.isArray(definition.params)
        ? definition.params.filter((item): item is string => typeof item === "string")
        : [];
    if (
      params.length !== new Set(params).size ||
      params.some((param) => !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(param))
    )
      diagnostics.push(
        diagnostic(
          "ERA_EXPR_FUNCTION_PARAMS",
          `函数 ${name} 的形参必须是互异标识符。`,
          { path: name }
        )
      );
    const expr = isRecord(definition) && typeof definition.expr === "string"
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
      diagnostics: [...diagnostics, ...result.diagnostics]
    });
  }
  return parsed;
}

function walk(ast: Ast, visitor: (item: Ast) => void): void {
  visitor(ast);
  if (ast.kind === "unary") walk(ast.value, visitor);
  if (ast.kind === "binary") {
    walk(ast.left, visitor);
    walk(ast.right, visitor);
  }
  if (ast.kind === "call") for (const arg of ast.args) walk(arg, visitor);
}

export function extractFunctionDependencies(
  parsed: readonly ParsedFunction[]
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
  parsed: readonly ParsedFunction[]
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
            { path: functionDef.name }
          )
        );
      if (item.kind === "call") {
        if (item.name === "random" && item.args.length > 2)
          diagnostics.push(
            diagnostic(
              "ERA_EXPR_BUILTIN_ARITY",
              `函数 ${functionDef.name} 中的 random 只接受零个、一个或两个参数。`,
              { path: functionDef.name }
            )
          );
        if (!isBuiltin(item.name) && !functions.has(item.name))
          diagnostics.push(
            diagnostic(
              "ERA_EXPR_FUNCTION_UNKNOWN_CALL",
              `函数 ${functionDef.name} 调用了未知函数 ${item.name}。`,
              { path: functionDef.name }
            )
          );
        const target = functions.get(item.name);
        if (target && item.args.length !== target.params.length)
          diagnostics.push(
            diagnostic(
              "ERA_EXPR_FUNCTION_ARITY",
              `函数 ${functionDef.name} 调用 ${item.name} 的实参数不匹配。`,
              { path: functionDef.name }
            )
          );
      }
    });
  }
  return diagnostics;
}

export function rejectRecursiveFunctions(
  dependencies: Readonly<Record<string, readonly string[]>>
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
          { path: name }
        )
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

function findRandomFunctions(
  parsed: readonly ParsedFunction[]
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
  diagnostics: readonly Diagnostic[]
): CompiledLibrary {
  const all = [...diagnostics];
  return {
    functions: Object.fromEntries(
      parsed
        .filter((item) => item.ast !== null)
        .map((item) => [item.name, item])
    ),
    randomFunctions: findRandomFunctions(parsed),
    diagnostics: all,
    valid: all.length === 0
  };
}

/** Compile one immutable function-library version for current or snapshot calls. */
export function compileFunctionLibrary(
  functionLibrary: Readonly<Record<string, unknown>>
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
    valid: true
  };
  const parsed = parseFunctionDefinitions(request);
  const dependencies = extractFunctionDependencies(parsed);
  return compileCallableFunctions(parsed, [
    ...validateFunctionPurity(parsed),
    ...rejectRecursiveFunctions(dependencies)
  ]);
}

export function countAutomaticRandomDraws(
  ast: Ast,
  currentLibrary: CompiledLibrary,
  snapshotLibrary: CompiledLibrary = currentLibrary
): number {
  const visiting = new Set<ParsedFunction>();
  const count = (item: Ast, library: CompiledLibrary): number => {
    if (item.kind === "literal" || item.kind === "ref") return 0;
    if (item.kind === "unary") return count(item.value, library);
    if (item.kind === "binary")
      return count(item.left, library) + count(item.right, library);
    let total = item.args.reduce(
      (sum, arg) => sum + count(arg, library),
      0
    );
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
  snapshotLibrary: CompiledLibrary = currentLibrary
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

export function parseOperations(
  request: NormalizedRequest
): readonly ParsedOperation[] {
  return request.operations.map((operation, index) => {
    const diagnostics: Diagnostic[] = [];
    let path: readonly string[] = [];
    try {
      path = validatePath(operation.path);
    } catch (error) {
      diagnostics.push(
        error instanceof ExpressionFailure
          ? error.detail
          : diagnostic("ERA_EXPR_PATH_INVALID", String(error))
      );
    }
    const parsed =
      diagnostics.length === 0
        ? parseExpression(operation.expr, request.allowSnapshots)
        : { ast: null, diagnostics: [] as readonly Diagnostic[] };
    return {
      index,
      path,
      expr: operation.expr,
      ast: parsed.ast,
      diagnostics: [...diagnostics, ...parsed.diagnostics]
    };
  });
}

export function initializeSequenceState(
  request: NormalizedRequest,
  compiled: CompiledLibrary,
  operations: readonly ParsedOperation[],
  snapshotCompiled: CompiledLibrary = compiled
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
    diagnostics: [...request.diagnostics, ...compiled.diagnostics]
  };
}

interface EvalFrame {
  readonly kind: "eval";
  readonly ast: Ast;
  readonly env: Readonly<Record<string, number>>;
  readonly allowState: boolean;
  readonly library: CompiledLibrary;
}
interface UnaryFrame {
  readonly kind: "unary";
  readonly op: "+" | "-";
}
interface BinaryFrame {
  readonly kind: "binary";
  readonly op: "+" | "-" | "*" | "/" | "%" | "^";
}
interface BuiltinFrame {
  readonly kind: "builtin";
  readonly name: string;
  readonly count: number;
}
interface RandomFrame {
  readonly kind: "random";
  readonly count: number;
}
interface CustomFrame {
  readonly kind: "custom";
  readonly name: string;
  readonly count: number;
  readonly library: CompiledLibrary;
}
interface CalculusFrame {
  readonly kind: "calculus";
  readonly name: "derivative" | "integral";
  readonly target: string;
  readonly count: number;
  readonly library: CompiledLibrary;
}
type EvalFrameEntry =
  | EvalFrame
  | UnaryFrame
  | BinaryFrame
  | BuiltinFrame
  | RandomFrame
  | CustomFrame
  | CalculusFrame;

export interface AstFrameState {
  readonly sequence: SequenceState;
  readonly stack: readonly EvalFrameEntry[];
  readonly values: readonly number[];
  readonly automaticRandomDrawCursor: number;
  readonly done: boolean;
  readonly result: number | null;
  readonly diagnostics: readonly Diagnostic[];
}

function refValue(
  ast: Extract<Ast, { kind: "ref" }>,
  state: SequenceState,
  env: Readonly<Record<string, number>>,
  allowState: boolean
): number {
  if (ast.path.length === 1 && ast.path[0]! in env) return env[ast.path[0]!]!;
  if (!allowState)
    throw new ExpressionFailure(
      diagnostic("ERA_EXPR_FUNCTION_IMPURE", "函数体不能读取外部变量状态。", {
        path: ast.path.join(".")
      })
    );
  const source = ast.snapshot ? state.startState : state.currentState;
  const value = getPath(source, ast.path);
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_REFERENCE_NON_NUMERIC",
        `变量 ${ast.path.join(".")} 必须已定义为有限数字。`,
        { path: ast.path.join(".") }
      )
    );
  return value;
}

function popValues(
  values: readonly number[],
  count: number
): { readonly values: readonly number[]; readonly args: readonly number[] } {
  if (count === 0) return { values, args: [] };
  if (values.length < count)
    throw new ExpressionFailure(
      diagnostic("ERA_EXPR_EVALUATION_STACK", "表达式求值栈缺少子表达式结果。")
    );
  return { values: values.slice(0, -count), args: values.slice(-count) };
}

const UINT64_MASK = (1n << 64n) - 1n;
const FNV64_OFFSET = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const SPLITMIX_GAMMA = 0x9e3779b97f4a7c15n;
const SPLITMIX_MUL_1 = 0xbf58476d1ce4e5b9n;
const SPLITMIX_MUL_2 = 0x94d049bb133111ebn;
const TWO_POW_53 = 9007199254740992;

function fnv1a64(bytes: Uint8Array): bigint {
  return bytes.reduce(
    (hash, byte) => ((hash ^ BigInt(byte)) * FNV64_PRIME) & UINT64_MASK,
    FNV64_OFFSET
  );
}

function randomSeedHash(seed: string | number): bigint {
  if (typeof seed === "string") return fnv1a64(new TextEncoder().encode(seed));
  const normalized = Object.is(seed, -0) ? 0 : seed;
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, normalized, true);
  return fnv1a64(new Uint8Array(buffer));
}

/** Stable public ABI used by Node, Browser and test-pack reference vectors. */
export function deterministicRandomUnit(
  seed: string | number,
  draw: number
): number {
  if (
    (typeof seed === "number" && !Number.isFinite(seed)) ||
    !Number.isSafeInteger(draw) ||
    draw < 0
  )
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_RANDOM_DRAW_INVALID",
        "random 的 seed 必须有限，draw 必须是非负安全整数。"
      )
    );
  const mixed0 =
    (randomSeedHash(seed) + BigInt(draw) + SPLITMIX_GAMMA) & UINT64_MASK;
  const mixed1 = ((mixed0 ^ (mixed0 >> 30n)) * SPLITMIX_MUL_1) & UINT64_MASK;
  const mixed2 = ((mixed1 ^ (mixed1 >> 27n)) * SPLITMIX_MUL_2) & UINT64_MASK;
  const mixed3 = mixed2 ^ (mixed2 >> 31n);
  return Number((mixed3 & UINT64_MASK) >> 11n) / TWO_POW_53;
}

function calculateRandom(
  args: readonly number[],
  context: RandomContext | null,
  automaticDraw: number
): number {
  if (args.length > 2)
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_BUILTIN_ARITY",
        "random 只接受零个、一个或两个参数。"
      )
    );
  if (args.length < 2 && !context)
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_RANDOM_CONTEXT_REQUIRED",
        "random() 与 random(seed) 需要消息随机上下文。"
      )
    );
  const seed = args.length === 0 ? context!.sourceKey : args[0]!;
  const draw = args.length === 2 ? args[1]! : automaticDraw;
  if (!Number.isSafeInteger(draw) || draw < 0)
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_RANDOM_DRAW_INVALID",
        "random 的 draw 必须是非负安全整数。"
      )
    );
  return deterministicRandomUnit(seed, draw);
}

function calculateBuiltin(name: string, args: readonly number[]): number {
  const unary: Readonly<Record<string, (value: number) => number>> = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    asinh: Math.asinh,
    acosh: Math.acosh,
    atanh: Math.atanh,
    exp: Math.exp,
    log: Math.log,
    ln: Math.log,
    sqrt: Math.sqrt,
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    trunc: Math.trunc,
    gamma
  };
  if (name in unary) {
    if (args.length !== 1)
      throw new ExpressionFailure(
        diagnostic("ERA_EXPR_BUILTIN_ARITY", `${name} 需要一个参数。`)
      );
    return finite(
      unary[name]!(args[0]!),
      "ERA_EXPR_BUILTIN_NON_FINITE",
      `${name} 产生了非有限结果。`
    );
  }
  if (name === "factorial") {
    if (args.length !== 1 || !Number.isSafeInteger(args[0]!) || args[0]! < 0)
      throw new ExpressionFailure(
        diagnostic(
          "ERA_EXPR_FACTORIAL_DOMAIN",
          "factorial 只接受非负安全整数。"
        )
      );
    let result = 1;
    for (let value = 2; value <= args[0]!; value += 1)
      result = finite(
        result * value,
        "ERA_EXPR_FACTORIAL_NON_FINITE",
        "factorial 产生了非有限结果。"
      );
    return result;
  }
  if (name === "min" || name === "max") {
    if (args.length === 0)
      throw new ExpressionFailure(
        diagnostic("ERA_EXPR_BUILTIN_ARITY", `${name} 至少需要一个参数。`)
      );
    return name === "min" ? Math.min(...args) : Math.max(...args);
  }
  if (name === "clamp") {
    if (args.length !== 3)
      throw new ExpressionFailure(
        diagnostic("ERA_EXPR_BUILTIN_ARITY", "clamp 需要三个参数。")
      );
    return Math.min(Math.max(args[0]!, args[1]!), args[2]!);
  }
  if (name === "pow" || name === "mod") {
    if (args.length !== 2)
      throw new ExpressionFailure(
        diagnostic("ERA_EXPR_BUILTIN_ARITY", `${name} 需要两个参数。`)
      );
    return finite(
      name === "pow" ? args[0]! ** args[1]! : args[0]! % args[1]!,
      "ERA_EXPR_BUILTIN_NON_FINITE",
      `${name} 产生了非有限结果。`
    );
  }
  throw new ExpressionFailure(
    diagnostic("ERA_EXPR_BUILTIN_UNKNOWN", `未知内建函数 ${name}。`)
  );
}

function inlineCustomAst(
  ast: Ast,
  bindings: Readonly<Record<string, Ast>>,
  library: CompiledLibrary
): Ast {
  if (ast.kind === "literal") return ast;
  if (ast.kind === "ref") return bindings[ast.path.join(".")] ?? ast;
  if (ast.kind === "unary")
    return { ...ast, value: inlineCustomAst(ast.value, bindings, library) };
  if (ast.kind === "binary")
    return {
      ...ast,
      left: inlineCustomAst(ast.left, bindings, library),
      right: inlineCustomAst(ast.right, bindings, library)
    };
  const target = library.functions[ast.name];
  const args = ast.args.map((arg) => inlineCustomAst(arg, bindings, library));
  if (!target || !target.ast)
    return { kind: "call", name: ast.name, args, snapshot: ast.snapshot };
  const childBindings = Object.fromEntries(
    target.params.map((param, index) => [param, args[index]!])
  ) as Record<string, Ast>;
  return inlineCustomAst(target.ast, childBindings, library);
}

function mathText(ast: Ast): string {
  if (ast.kind === "literal")
    return Number.isInteger(ast.value) ? `${ast.value}` : `${ast.value}`;
  if (ast.kind === "ref") return ast.path.join("_");
  if (ast.kind === "unary") return `(${ast.op}${mathText(ast.value)})`;
  if (ast.kind === "binary")
    return `(${mathText(ast.left)} ${ast.op} ${mathText(ast.right)})`;
  const names: Readonly<Record<string, string>> = {
    ln: "log",
    pow: "pow",
    mod: "mod"
  };
  return `${names[ast.name] ?? ast.name}(${ast.args.map(mathText).join(",")})`;
}

function evaluateFunctionAt(
  library: CompiledLibrary,
  name: string,
  input: number
): number {
  const target = library.functions[name];
  if (!target || !target.ast || target.params.length !== 1)
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_CALCULUS_TARGET",
        `${name} 必须是已定义的一元纯函数。`,
        { path: name }
      )
    );
  const sequence: SequenceState = {
    startState: {},
    currentState: {},
    compiled: library,
    snapshotCompiled: library,
    operations: [],
    cursor: 0,
    randomContext: null,
    randomDrawsConsumed: 0,
    diagnostics: []
  };
  let frame = createAstFrameState(
    sequence,
    target.ast,
    { [target.params[0]!]: input },
    false
  );
  while (!frame.done) frame = advanceAstFrame(frame);
  if (frame.diagnostics.length > 0 || frame.result === null)
    throw new ExpressionFailure(
      frame.diagnostics[0] ??
        diagnostic("ERA_EXPR_CALCULUS_EVALUATE", `函数 ${name} 无法求值。`, {
          path: name
        })
    );
  return frame.result;
}

function calculateCalculus(
  name: "derivative" | "integral",
  target: string,
  args: readonly number[],
  library: CompiledLibrary
): number {
  const functionDef = library.functions[target];
  if (!functionDef || !functionDef.ast || functionDef.params.length !== 1)
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_CALCULUS_TARGET",
        `${name} 只接受已定义的一元纯函数。`,
        { path: target }
      )
    );
  if (library.randomFunctions.includes(target))
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_CALCULUS_RANDOM_FORBIDDEN",
        `${name} 不能以直接或间接调用 random 的函数为目标。`,
        { path: target }
      )
    );
  if (name === "derivative") {
    if (args.length !== 1 && args.length !== 2)
      throw new ExpressionFailure(
        diagnostic(
          "ERA_EXPR_BUILTIN_ARITY",
          "derivative 需要 f、at 与可选 order。"
        )
      );
    const order = args.length === 2 ? args[1]! : 1;
    if (!Number.isSafeInteger(order) || order <= 0)
      throw new ExpressionFailure(
        diagnostic(
          "ERA_EXPR_DERIVATIVE_ORDER",
          "导数阶数必须是任意正安全整数。"
        )
      );
    const expanded = inlineCustomAst(functionDef.ast, {}, library);
    let derived = mathText(expanded);
    const variable = functionDef.params[0]!;
    try {
      for (let currentOrder = 0; currentOrder < order; currentOrder += 1) {
        const node = derivative(derived, variable);
        derived = node.toString();
        if (derived === "0") break;
      }
      const value = Number(mathEvaluate(derived, { [variable]: args[0]! }));
      return finite(
        value,
        "ERA_EXPR_DERIVATIVE_NON_FINITE",
        "导数产生了非有限结果。"
      );
    } catch (error) {
      throw new ExpressionFailure(
        diagnostic(
          "ERA_EXPR_DERIVATIVE_UNSUPPORTED",
          `无法构造该导数：${error instanceof Error ? error.message : String(error)}。`,
          { path: target }
        )
      );
    }
  }
  if (args.length !== 2)
    throw new ExpressionFailure(
      diagnostic("ERA_EXPR_BUILTIN_ARITY", "integral 需要 f、start、end。")
    );
  const [start, end] = args;
  if (start === end) return 0;
  const direction = start! < end! ? 1 : -1;
  const left = Math.min(start!, end!);
  const right = Math.max(start!, end!);
  const evaluate = (value: number): number =>
    evaluateFunctionAt(library, target, value);
  const simpson = (
    a: number,
    b: number,
    fa: number,
    fm: number,
    fb: number
  ): number => ((b - a) / 6) * (fa + 4 * fm + fb);
  const middle = (left + right) / 2;
  const whole = simpson(
    left,
    right,
    evaluate(left),
    evaluate(middle),
    evaluate(right)
  );
  const stack: {
    a: number;
    b: number;
    fa: number;
    fm: number;
    fb: number;
    whole: number;
    tolerance: number;
  }[] = [
    {
      a: left,
      b: right,
      fa: evaluate(left),
      fm: evaluate(middle),
      fb: evaluate(right),
      whole,
      tolerance: 1e-9
    }
  ];
  let sum = 0;
  let processed = 0;
  while (stack.length > 0) {
    const segment = stack.pop()!;
    processed += 1;
    if (processed > 65536)
      throw new ExpressionFailure(
        diagnostic(
          "ERA_EXPR_INTEGRAL_CONVERGENCE",
          "积分在确定性 Simpson 迭代内未收敛。",
          { path: target }
        )
      );
    const mid = (segment.a + segment.b) / 2;
    const leftMid = (segment.a + mid) / 2;
    const rightMid = (mid + segment.b) / 2;
    const leftValue = evaluate(leftMid);
    const rightValue = evaluate(rightMid);
    const leftArea = simpson(segment.a, mid, segment.fa, leftValue, segment.fm);
    const rightArea = simpson(
      mid,
      segment.b,
      segment.fm,
      rightValue,
      segment.fb
    );
    const delta = leftArea + rightArea - segment.whole;
    if (Math.abs(delta) <= 15 * segment.tolerance) {
      sum += leftArea + rightArea + delta / 15;
      continue;
    }
    stack.push({
      a: mid,
      b: segment.b,
      fa: segment.fm,
      fm: rightValue,
      fb: segment.fb,
      whole: rightArea,
      tolerance: segment.tolerance / 2
    });
    stack.push({
      a: segment.a,
      b: mid,
      fa: segment.fa,
      fm: leftValue,
      fb: segment.fm,
      whole: leftArea,
      tolerance: segment.tolerance / 2
    });
  }
  return finite(
    direction * sum,
    "ERA_EXPR_INTEGRAL_NON_FINITE",
    "积分产生了非有限结果。"
  );
}

export function createAstFrameState(
  sequence: SequenceState,
  ast: Ast,
  env: Readonly<Record<string, number>> = {},
  allowState = true,
  library: CompiledLibrary = sequence.compiled
): AstFrameState {
  return {
    sequence,
    stack: [{ kind: "eval", ast, env, allowState, library }],
    values: [],
    automaticRandomDrawCursor:
      (sequence.randomContext?.drawOffset ?? 0) + sequence.randomDrawsConsumed,
    done: false,
    result: null,
    diagnostics: []
  };
}

function complete(
  state: Omit<AstFrameState, "done" | "result">
): AstFrameState {
  if (state.stack.length === 0 && state.values.length === 1)
    return { ...state, done: true, result: state.values[0]! };
  return { ...state, done: false, result: null };
}

export function astFrameRoute(
  state: AstFrameState
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

export function advanceAstFrame(
  state: AstFrameState,
  expected?: ReturnType<typeof astFrameRoute>
): AstFrameState {
  if (state.done) return state;
  try {
    const actual = astFrameRoute(state);
    if (expected && actual !== expected)
      throw new ExpressionFailure(
        diagnostic(
          "ERA_EXPR_FRAME_ROUTE",
          `调用帧路由不匹配：期望 ${expected}，实际 ${actual}。`
        )
      );
    const stack = [...state.stack];
    const values = [...state.values];
    let automaticRandomDrawCursor = state.automaticRandomDrawCursor;
    const top = stack.pop();
    if (!top) return complete({ ...state, stack, values });
    if (top.kind === "eval") {
      if (top.ast.kind === "literal") values.push(top.ast.value);
      else if (top.ast.kind === "ref")
        values.push(refValue(top.ast, state.sequence, top.env, top.allowState));
      else if (top.ast.kind === "unary") {
        stack.push(
          { kind: "unary", op: top.ast.op },
          {
            kind: "eval",
            ast: top.ast.value,
            env: top.env,
            allowState: top.allowState,
            library: top.library
          }
        );
      } else if (top.ast.kind === "binary") {
        stack.push(
          { kind: "binary", op: top.ast.op },
          {
            kind: "eval",
            ast: top.ast.right,
            env: top.env,
            allowState: top.allowState,
            library: top.library
          },
          {
            kind: "eval",
            ast: top.ast.left,
            env: top.env,
            allowState: top.allowState,
            library: top.library
          }
        );
      } else if (top.ast.kind === "call") {
        if (top.ast.name === "derivative" || top.ast.name === "integral") {
          if (top.ast.snapshot)
            throw new ExpressionFailure(
              diagnostic(
                "ERA_EXPR_SNAPSHOT_FUNCTION_REQUIRED",
                "@ 仅可用于自定义函数调用。"
              )
            );
          const targetAst = top.ast.args[0];
          if (
            !targetAst ||
            targetAst.kind !== "ref" ||
            targetAst.snapshot ||
            targetAst.path.length !== 1
          )
            throw new ExpressionFailure(
              diagnostic(
                "ERA_EXPR_CALCULUS_TARGET",
                `${top.ast.name} 的首参必须是已定义函数名。`
              )
            );
          stack.push({
            kind: "calculus",
            name: top.ast.name,
            target: targetAst.path[0]!,
            count: top.ast.args.length - 1,
            library: top.library
          });
          for (const arg of [...top.ast.args.slice(1)].reverse())
            stack.push({
              kind: "eval",
              ast: arg,
              env: top.env,
              allowState: top.allowState,
              library: top.library
            });
        } else if (top.ast.name === "random") {
          if (top.ast.snapshot)
            throw new ExpressionFailure(
              diagnostic(
                "ERA_EXPR_SNAPSHOT_FUNCTION_REQUIRED",
                "@ 仅可用于自定义函数调用。"
              )
            );
          stack.push({ kind: "random", count: top.ast.args.length });
          for (const arg of [...top.ast.args].reverse())
            stack.push({
              kind: "eval",
              ast: arg,
              env: top.env,
              allowState: top.allowState,
              library: top.library
            });
        } else if (isBuiltin(top.ast.name)) {
          if (top.ast.snapshot)
            throw new ExpressionFailure(
              diagnostic(
                "ERA_EXPR_SNAPSHOT_FUNCTION_REQUIRED",
                "@ 仅可用于自定义函数调用。"
              )
            );
          stack.push({
            kind: "builtin",
            name: top.ast.name,
            count: top.ast.args.length
          });
          for (const arg of [...top.ast.args].reverse())
            stack.push({
              kind: "eval",
              ast: arg,
              env: top.env,
              allowState: top.allowState,
              library: top.library
            });
        } else {
          stack.push({
            kind: "custom",
            name: top.ast.name,
            count: top.ast.args.length,
            library: top.ast.snapshot
              ? state.sequence.snapshotCompiled
              : top.library
          });
          for (const arg of [...top.ast.args].reverse())
            stack.push({
              kind: "eval",
              ast: arg,
              env: top.env,
              allowState: top.allowState,
              library: top.library
            });
        }
      }
    } else if (top.kind === "unary") {
      const popped = popValues(values, 1);
      values.splice(
        0,
        values.length,
        ...popped.values,
        finite(
          top.op === "+" ? popped.args[0]! : -popped.args[0]!,
          "ERA_EXPR_RESULT_NON_FINITE",
          "一元运算产生了非有限结果。"
        )
      );
    } else if (top.kind === "binary") {
      const popped = popValues(values, 2);
      const [left, right] = popped.args;
      const result =
        top.op === "+"
          ? left! + right!
          : top.op === "-"
            ? left! - right!
            : top.op === "*"
              ? left! * right!
              : top.op === "/"
                ? left! / right!
                : top.op === "%"
                  ? left! % right!
                  : left! ** right!;
      values.splice(
        0,
        values.length,
        ...popped.values,
        finite(
          result,
          "ERA_EXPR_RESULT_NON_FINITE",
          "二元运算产生了非有限结果。"
        )
      );
    } else if (top.kind === "builtin") {
      const popped = popValues(values, top.count);
      values.splice(
        0,
        values.length,
        ...popped.values,
        calculateBuiltin(top.name, popped.args)
      );
    } else if (top.kind === "random") {
      const popped = popValues(values, top.count);
      const draw = automaticRandomDrawCursor;
      if (top.count < 2) automaticRandomDrawCursor += 1;
      values.splice(
        0,
        values.length,
        ...popped.values,
        calculateRandom(popped.args, state.sequence.randomContext, draw)
      );
    } else if (top.kind === "calculus") {
      const popped = popValues(values, top.count);
      values.splice(
        0,
        values.length,
        ...popped.values,
        calculateCalculus(
          top.name,
          top.target,
          popped.args,
          top.library
        )
      );
    } else {
      const popped = popValues(values, top.count);
      const target = top.library.functions[top.name];
      if (!target || !target.ast)
        throw new ExpressionFailure(
          diagnostic(
            "ERA_EXPR_FUNCTION_UNKNOWN_CALL",
            `未知函数 ${top.name}。`,
            { path: top.name }
          )
        );
      if (target.params.length !== popped.args.length)
        throw new ExpressionFailure(
          diagnostic(
            "ERA_EXPR_FUNCTION_ARITY",
            `函数 ${top.name} 实参数不匹配。`,
            { path: top.name }
          )
        );
      const env = Object.fromEntries(
        target.params.map((param, index) => [param, popped.args[index]!])
      ) as Record<string, number>;
      values.splice(0, values.length, ...popped.values);
      stack.push({
        kind: "eval",
        ast: target.ast,
        env,
        allowState: false,
        library: top.library
      });
    }
    return complete({ ...state, stack, values, automaticRandomDrawCursor });
  } catch (error) {
    const detail =
      error instanceof ExpressionFailure
        ? error.detail
        : diagnostic(
            "ERA_EXPR_EVALUATION_FAILED",
            error instanceof Error ? error.message : String(error)
          );
    return {
      ...state,
      stack: [],
      done: true,
      result: null,
      diagnostics: [...state.diagnostics, detail]
    };
  }
}

export function runOperationStep(state: SequenceState): {
  readonly sequenceStateNext: SequenceState;
  readonly sequenceDone: boolean;
  readonly operationExecutionResult: {
    readonly finalState: JsonValue;
    readonly diagnostics: readonly Diagnostic[];
    readonly randomDrawsConsumed: number;
  };
} {
  const operation = state.operations[state.cursor];
  if (!operation)
    return {
      sequenceStateNext: state,
      sequenceDone: true,
      operationExecutionResult: {
        finalState: state.currentState,
        diagnostics: state.diagnostics,
        randomDrawsConsumed: state.randomDrawsConsumed
      }
    };
  if (!state.compiled.valid) {
    const next: SequenceState = {
      ...state,
      cursor: state.cursor + 1,
      diagnostics: [...state.diagnostics, ...operation.diagnostics]
    };
    return {
      sequenceStateNext: next,
      sequenceDone: next.cursor >= next.operations.length,
      operationExecutionResult: {
        finalState: next.currentState,
        diagnostics: next.diagnostics,
        randomDrawsConsumed: next.randomDrawsConsumed
      }
    };
  }
  if (!operation.ast || operation.diagnostics.length > 0) {
    const next: SequenceState = {
      ...state,
      cursor: state.cursor + 1,
      diagnostics: [...state.diagnostics, ...operation.diagnostics]
    };
    return {
      sequenceStateNext: next,
      sequenceDone: next.cursor >= next.operations.length,
      operationExecutionResult: {
        finalState: next.currentState,
        diagnostics: next.diagnostics,
        randomDrawsConsumed: next.randomDrawsConsumed
      }
    };
  }
  const randomDraws = countAutomaticRandomDraws(
    operation.ast,
    state.compiled,
    state.snapshotCompiled
  );
  let frame = createAstFrameState(state, operation.ast);
  while (!frame.done) frame = advanceAstFrame(frame);
  const diagnostics = [...state.diagnostics, ...frame.diagnostics];
  const currentState =
    frame.result === null
      ? state.currentState
      : setPath(state.currentState, operation.path, frame.result);
  const next: SequenceState = {
    ...state,
    currentState,
    cursor: state.cursor + 1,
    randomDrawsConsumed: state.randomDrawsConsumed + randomDraws,
    diagnostics
  };
  return {
    sequenceStateNext: next,
    sequenceDone: next.cursor >= next.operations.length,
    operationExecutionResult: {
      finalState: next.currentState,
      diagnostics: next.diagnostics,
      randomDrawsConsumed: next.randomDrawsConsumed
    }
  };
}

export function commitOperationResult(
  state: SequenceState,
  value: number | null,
  evaluationDiagnostics: readonly Diagnostic[]
): {
  readonly sequenceStateNext: SequenceState;
  readonly sequenceDone: boolean;
  readonly operationExecutionResult: {
    readonly finalState: JsonValue;
    readonly diagnostics: readonly Diagnostic[];
    readonly randomDrawsConsumed: number;
  };
} {
  const operation = state.operations[state.cursor];
  if (!operation)
    return {
      sequenceStateNext: state,
      sequenceDone: true,
      operationExecutionResult: {
        finalState: state.currentState,
        diagnostics: state.diagnostics,
        randomDrawsConsumed: state.randomDrawsConsumed
      }
    };
  const diagnostics = [
    ...state.diagnostics,
    ...operation.diagnostics,
    ...evaluationDiagnostics
  ];
  const currentState =
    state.compiled.valid &&
    operation.ast &&
    operation.diagnostics.length === 0 &&
    value !== null
      ? setPath(state.currentState, operation.path, value)
      : state.currentState;
  const randomDraws =
    state.compiled.valid && operation.ast && operation.diagnostics.length === 0
      ? countAutomaticRandomDraws(
          operation.ast,
          state.compiled,
          state.snapshotCompiled
        )
      : 0;
  const next: SequenceState = {
    ...state,
    currentState,
    cursor: state.cursor + 1,
    randomDrawsConsumed: state.randomDrawsConsumed + randomDraws,
    diagnostics
  };
  return {
    sequenceStateNext: next,
    sequenceDone: next.cursor >= next.operations.length,
    operationExecutionResult: {
      finalState: next.currentState,
      diagnostics: next.diagnostics,
      randomDrawsConsumed: next.randomDrawsConsumed
    }
  };
}

function substituteSymbolic(
  ast: Ast,
  state: Readonly<Record<string, Ast>>
): Ast {
  if (ast.kind === "literal") return ast;
  if (ast.kind === "ref")
    return (
      state[ast.path.join(".")] ?? {
        kind: "ref",
        path: ast.path,
        snapshot: true
      }
    );
  if (ast.kind === "unary")
    return simplify({
      kind: "unary",
      op: ast.op,
      value: substituteSymbolic(ast.value, state)
    });
  if (ast.kind === "binary")
    return simplify({
      kind: "binary",
      op: ast.op,
      left: substituteSymbolic(ast.left, state),
      right: substituteSymbolic(ast.right, state)
    });
  return {
    kind: "call",
    name: ast.name,
    args: ast.args.map((arg) => substituteSymbolic(arg, state)),
    snapshot: ast.snapshot
  };
}

function literal(value: number): Ast {
  return { kind: "literal", value: Object.is(value, -0) ? 0 : value };
}
function literalNumber(ast: Ast): number | undefined {
  return ast.kind === "literal" ? ast.value : undefined;
}

export function simplify(ast: Ast): Ast {
  if (ast.kind === "literal" || ast.kind === "ref") return ast;
  if (ast.kind === "call") return { ...ast, args: ast.args.map(simplify) };
  if (ast.kind === "unary") {
    const value = simplify(ast.value);
    const number = literalNumber(value);
    if (number !== undefined) return literal(ast.op === "+" ? number : -number);
    if (ast.op === "+") return value;
    return { ...ast, value };
  }
  const left = simplify(ast.left);
  const right = simplify(ast.right);
  const leftNumber = literalNumber(left);
  const rightNumber = literalNumber(right);
  if (leftNumber !== undefined && rightNumber !== undefined) {
    const result =
      ast.op === "+"
        ? leftNumber + rightNumber
        : ast.op === "-"
          ? leftNumber - rightNumber
          : ast.op === "*"
            ? leftNumber * rightNumber
            : ast.op === "/"
              ? leftNumber / rightNumber
              : ast.op === "%"
                ? leftNumber % rightNumber
                : leftNumber ** rightNumber;
    return Number.isFinite(result) ? literal(result) : { ...ast, left, right };
  }
  if (ast.op === "+") {
    if (rightNumber === 0) return left;
    if (leftNumber === 0) return right;
    const nested =
      left.kind === "binary" && left.op === "+"
        ? literalNumber(left.right)
        : undefined;
    if (
      left.kind === "binary" &&
      left.op === "+" &&
      nested !== undefined &&
      rightNumber !== undefined
    )
      return simplify({
        kind: "binary",
        op: "+",
        left: left.left,
        right: literal(nested + rightNumber)
      });
    const subtraction =
      left.kind === "binary" && left.op === "-"
        ? literalNumber(left.right)
        : undefined;
    if (
      left.kind === "binary" &&
      left.op === "-" &&
      subtraction !== undefined &&
      rightNumber !== undefined
    )
      return simplify({
        kind: "binary",
        op: "-",
        left: left.left,
        right: literal(subtraction - rightNumber)
      });
  }
  if (ast.op === "-") {
    if (rightNumber === 0) return left;
    const nested =
      left.kind === "binary" && left.op === "-"
        ? literalNumber(left.right)
        : undefined;
    if (
      left.kind === "binary" &&
      left.op === "-" &&
      nested !== undefined &&
      rightNumber !== undefined
    )
      return simplify({
        kind: "binary",
        op: "-",
        left: left.left,
        right: literal(nested + rightNumber)
      });
    const addition =
      left.kind === "binary" && left.op === "+"
        ? literalNumber(left.right)
        : undefined;
    if (
      left.kind === "binary" &&
      left.op === "+" &&
      addition !== undefined &&
      rightNumber !== undefined
    )
      return simplify({
        kind: "binary",
        op: "+",
        left: left.left,
        right: literal(addition - rightNumber)
      });
  }
  if (ast.op === "*") {
    if (leftNumber === 0 || rightNumber === 0) return literal(0);
    if (leftNumber === 1) return right;
    if (rightNumber === 1) return left;
  }
  if (ast.op === "/" && rightNumber === 1) return left;
  return { ...ast, left, right };
}

function operatorPrecedence(
  op: Extract<Ast, { kind: "binary" }>["op"]
): number {
  return op === "+" || op === "-"
    ? 1
    : op === "*" || op === "/" || op === "%"
      ? 2
      : 3;
}
export function printAst(ast: Ast, parent = 0): string {
  if (ast.kind === "literal") return `${ast.value}`;
  if (ast.kind === "ref")
    return `${ast.snapshot ? "@" : ""}${ast.path.join(".")}`;
  if (ast.kind === "call")
    return `${ast.snapshot ? "@" : ""}${ast.name}(${ast.args.map((arg) => printAst(arg)).join(", ")})`;
  if (ast.kind === "unary") {
    const own = 4;
    const text = `${ast.op}${printAst(ast.value, own)}`;
    return own < parent ? `(${text})` : text;
  }
  const own = operatorPrecedence(ast.op);
  const text = `${printAst(ast.left, own)} ${ast.op} ${printAst(ast.right, own + (ast.op === "^" ? 0 : 1))}`;
  return own < parent ? `(${text})` : text;
}

export function deriveSymbolicLayer(
  sequence: SequenceState
): Readonly<Record<string, Ast>> {
  const symbols: Record<string, Ast> = {};
  const tainted = new Set<string>();
  const conflicts = (left: string, right: string): boolean =>
    left === right || left.startsWith(`${right}.`) || right.startsWith(`${left}.`);
  const referencesTainted = (ast: Ast): boolean => {
    let found = false;
    walk(ast, (item) => {
      if (
        item.kind === "ref" &&
        !item.snapshot &&
        [...tainted].some((path) => conflicts(item.path.join("."), path))
      )
        found = true;
    });
    return found;
  };
  for (const operation of sequence.operations) {
    if (!operation.ast || operation.diagnostics.length > 0) continue;
    const path = operation.path.join(".");
    if (
      countAutomaticRandomDraws(
        operation.ast,
        sequence.compiled,
        sequence.snapshotCompiled
      ) > 0 ||
      referencesTainted(operation.ast)
    ) {
      tainted.add(path);
      for (const existing of Object.keys(symbols))
        if (conflicts(existing, path)) delete symbols[existing];
      continue;
    }
    symbols[path] = simplify(substituteSymbolic(operation.ast, symbols));
  }
  return symbols;
}

export function normaliseCompaction(
  sequence: SequenceState,
  symbols: Readonly<Record<string, Ast>>
): ExpressionResponse {
  const compressed: Record<string, { $expr: string }> = {};
  for (const [path, ast] of Object.entries(symbols)) {
    const before = getPath(sequence.startState, path.split("."));
    const after = getPath(sequence.currentState, path.split("."));
    if (JSON.stringify(before) !== JSON.stringify(after))
      compressed[path] = { $expr: printAst(simplify(ast)) };
  }
  return {
    status:
      sequence.diagnostics.length === 0
        ? "ok"
        : sequence.cursor === 0
          ? "invalid"
          : "partial",
    finalState: sequence.currentState,
    diagnostics: sequence.diagnostics,
    compressed,
    compactedOperations: Object.entries(compressed).map(([path, value]) => ({
      path,
      value
    })),
    randomDrawsConsumed: sequence.randomDrawsConsumed,
    nextDrawOffset:
      (sequence.randomContext?.drawOffset ?? 0) + sequence.randomDrawsConsumed,
    containsAutomaticRandom: sequence.operations.some(
      (operation) =>
        operation.ast !== null &&
        operation.diagnostics.length === 0 &&
        countAutomaticRandomDraws(
          operation.ast,
          sequence.compiled,
          sequence.snapshotCompiled
        ) > 0
    )
  };
}

export function executeExpressionLayer(input: unknown): ExpressionResponse {
  const normalized = normaliseRequest(input);
  const compiled = compileFunctionLibrary(normalized.functionLibrary);
  const snapshotCompiled = normalized.snapshotFunctionLibrary
    ? compileFunctionLibrary(normalized.snapshotFunctionLibrary)
    : compiled;
  const operations = parseOperations(normalized);
  let state = initializeSequenceState(
    normalized,
    compiled,
    operations,
    snapshotCompiled
  );
  while (state.cursor < state.operations.length)
    state = runOperationStep(state).sequenceStateNext;
  return normaliseCompaction(state, deriveSymbolicLayer(state));
}

type NodeInputs = any;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
function nodeValue(value: unknown): {
  readonly value: number | null;
  readonly diagnostics: readonly Diagnostic[];
} {
  if (value !== null && typeof value === "object" && "value" in value) {
    const item = value as { value?: unknown; diagnostics?: unknown };
    return {
      value: typeof item.value === "number" ? item.value : null,
      diagnostics: Array.isArray(item.diagnostics)
        ? (item.diagnostics as Diagnostic[])
        : []
    };
  }
  return { value: null, diagnostics: [] };
}
export function terminalNode(): Record<string, never> {
  return {};
}
export function validateRequestNode(inputs: NodeInputs): any {
  return {
    normalized_expression_request: normaliseRequest(
      nodeInput(inputs, "era.expression.request")
    )
  };
}
export function validateRandomContextNode(inputs: NodeInputs): any {
  return {
    validated_random_request: nodeInput(
      inputs,
      "era.expression.request.normalized"
    )
  };
}
export function parseFunctionDefinitionsNode(inputs: NodeInputs): any {
  return {
    parsed_function_library: parseFunctionDefinitions(
      nodeInput(inputs, "era.expression.request.normalized")
    )
  };
}
export function extractFunctionDependenciesNode(inputs: NodeInputs): any {
  return {
    function_dependencies: extractFunctionDependencies(
      nodeInput(inputs, "era.expression.function_library.parsed")
    )
  };
}
export function validateFunctionPurityNode(inputs: NodeInputs): any {
  return {
    function_purity_report: {
      diagnostics: validateFunctionPurity(
        nodeInput<readonly ParsedFunction[]>(
          inputs,
          "era.expression.function_library.parsed"
        )
      )
    }
  };
}
export function buildFunctionCallGraphNode(inputs: NodeInputs): any {
  const dependencies = nodeInput<Readonly<Record<string, readonly string[]>>>(
    inputs,
    "era.expression.function_library.dependencies"
  );
  const purity = nodeInput<{ diagnostics: readonly Diagnostic[] }>(
    inputs,
    "era.expression.function_library.purity"
  );
  return {
    function_call_graph: { dependencies, diagnostics: purity.diagnostics }
  };
}
export function rejectRecursiveFunctionsNode(inputs: NodeInputs): any {
  const graph = nodeInput<{
    dependencies: Readonly<Record<string, readonly string[]>>;
    diagnostics: readonly Diagnostic[];
  }>(inputs, "era.expression.function_library.call_graph");
  return {
    acyclic_function_graph: {
      dependencies: graph.dependencies,
      diagnostics: [
        ...graph.diagnostics,
        ...rejectRecursiveFunctions(graph.dependencies)
      ]
    }
  };
}
export function compileCallableFunctionsNode(inputs: NodeInputs): any {
  return {
    compiled_function_library: compileCallableFunctions(
      nodeInput<readonly ParsedFunction[]>(
        inputs,
        "era.expression.function_library.parsed"
      ),
      nodeInput<{ diagnostics: readonly Diagnostic[] }>(
        inputs,
        "era.expression.function_library.acyclic_graph"
      ).diagnostics
    )
  };
}
export function parseOperationsNode(inputs: NodeInputs): any {
  return {
    parsed_operations: parseOperations(
      nodeInput(inputs, "era.expression.request.normalized")
    )
  };
}
export function classifyRandomCallsNode(inputs: NodeInputs): any {
  return {
    random_compiled_function_library: nodeInput(
      inputs,
      "era.expression.function_library.compiled"
    ),
    random_parsed_operations: nodeInput(inputs, "era.expression.operations.parsed")
  };
}
export function initializeSequenceStateNode(inputs: NodeInputs): any {
  const request = nodeInput<NormalizedRequest>(
    inputs,
    "era.expression.request.normalized"
  );
  const compiled = nodeInput<CompiledLibrary>(
    inputs,
    "era.expression.function_library.compiled"
  );
  const snapshotCompiled = request.snapshotFunctionLibrary
    ? compileFunctionLibrary(request.snapshotFunctionLibrary)
    : compiled;
  return {
    sequence_state: initializeSequenceState(
      request,
      compiled,
      nodeInput(inputs, "era.expression.operations.parsed"),
      snapshotCompiled
    )
  };
}
export function initializeRandomSequenceStateNode(inputs: NodeInputs): any {
  return initializeSequenceStateNode(inputs);
}
export function selectNextOperationNode(inputs: NodeInputs): any {
  const sequenceState = nodeInput<SequenceState>(
    inputs,
    "era.expression.sequence.state"
  );
  return {
    current_operation: {
      sequenceState,
      operation: sequenceState.operations[sequenceState.cursor] ?? null
    }
  };
}
export function initializeAstFramesNode(inputs: NodeInputs): any {
  const current = nodeInput<{
    sequenceState: SequenceState;
    operation: { ast: Ast | null } | null;
  }>(inputs, "era.expression.operation.current");
  const ast =
    current.sequenceState.compiled.valid && current.operation?.ast
      ? current.operation.ast
      : { kind: "literal" as const, value: 0 };
  return { ast_frame_state: createAstFrameState(current.sequenceState, ast) };
}
export function inspectAstFrameNode(inputs: NodeInputs): any {
  const state = nodeInput<AstFrameState>(
    inputs,
    "era.expression.ast_frame.state"
  );
  return {
    ast_frame_current: {
      state,
      frame: state.stack[state.stack.length - 1] ?? null
    }
  };
}
export function routeAstFrameNode(inputs: NodeInputs): any {
  const current = nodeInput<{ state: AstFrameState }>(
    inputs,
    "era.expression.ast_frame.current"
  );
  return {
    routed_ast_frame_current: current,
    ast_frame_route: astFrameRoute(current.state)
  };
}
function advanceNode(
  inputs: NodeInputs,
  expected: ReturnType<typeof astFrameRoute>,
  key: string
): object {
  return {
    [key]: advanceAstFrame(
      nodeInput<{ state: AstFrameState }>(
        inputs,
        "era.expression.ast_frame.current"
      ).state,
      expected
    )
  };
}
export function resolveValueFrameNode(inputs: NodeInputs): any {
  return advanceNode(inputs, "value", "frame_transition_value");
}
export function evaluateOperatorFrameNode(inputs: NodeInputs): any {
  return advanceNode(inputs, "operator", "frame_transition_operator");
}
export function evaluateBuiltinFrameNode(inputs: NodeInputs): any {
  return advanceNode(inputs, "builtin", "frame_transition_builtin");
}
export function evaluateCounterRandomNode(inputs: NodeInputs): any {
  return advanceNode(inputs, "random", "ast_frame_transition");
}
export function bindCustomFunctionFrameNode(inputs: NodeInputs): any {
  return advanceNode(inputs, "custom", "frame_transition_custom");
}
export function returnChildValueNode(inputs: NodeInputs): any {
  return advanceNode(inputs, "return", "frame_transition_return");
}
export function publishFrameTransitionNode(inputs: NodeInputs): any {
  const state = nodeInput<AstFrameState>(
    inputs,
    "era.expression.ast_frame.transition"
  );
  return {
    ast_frame_state_next: state,
    ast_frame_done: state.done,
    evaluated_expression: {
      value: state.result,
      diagnostics: state.diagnostics
    }
  };
}
export function commitOperationResultNode(inputs: NodeInputs): any {
  const current = nodeInput<{ sequenceState: SequenceState }>(
    inputs,
    "era.expression.operation.current"
  );
  const evaluated = nodeValue(nodeInput(inputs, "era.expression.value"));
  const outcome = commitOperationResult(
    current.sequenceState,
    evaluated.value,
    evaluated.diagnostics
  );
  return {
    sequence_state_next: outcome.sequenceStateNext,
    sequence_done: outcome.sequenceDone,
    operation_execution_result: outcome.operationExecutionResult
  };
}
function completeNodeState(
  initial: SequenceState,
  execution: {
    finalState: SequenceState["currentState"];
    diagnostics: readonly Diagnostic[];
    randomDrawsConsumed?: number;
  }
): SequenceState {
  return {
    ...initial,
    currentState: execution.finalState,
    diagnostics: execution.diagnostics,
    randomDrawsConsumed:
      execution.randomDrawsConsumed ?? initial.randomDrawsConsumed,
    cursor: initial.operations.length
  };
}
export function deriveSymbolicLayerNode(inputs: NodeInputs): any {
  const sequence = nodeInput<SequenceState>(
    inputs,
    "era.expression.sequence.state"
  );
  const execution = nodeInput<{
    finalState: SequenceState["currentState"];
    diagnostics: readonly Diagnostic[];
    randomDrawsConsumed?: number;
  }>(inputs, "era.expression.execution.result");
  return {
    symbolic_layer: deriveSymbolicLayer(completeNodeState(sequence, execution))
  };
}
export function guardRandomCompactionNode(inputs: NodeInputs): any {
  return {
    random_guarded_symbolic_layer: nodeInput(
      inputs,
      "era.expression.symbolic.layer"
    )
  };
}
export function normalizeCompactionNode(inputs: NodeInputs): any {
  const sequence = nodeInput<SequenceState>(
    inputs,
    "era.expression.sequence.state"
  );
  const execution = nodeInput<{
    finalState: SequenceState["currentState"];
    diagnostics: readonly Diagnostic[];
    randomDrawsConsumed?: number;
  }>(inputs, "era.expression.execution.result");
  return {
    expression_response: normaliseCompaction(
      completeNodeState(sequence, execution),
      nodeInput(inputs, "era.expression.symbolic.layer")
    )
  };
}
