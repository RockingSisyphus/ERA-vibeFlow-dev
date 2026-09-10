import {
  ExpressionFailure,
  diagnostic,
  finite,
  isRecord,
  clone,
} from "./expression_primitives.ts";
import {
  Ast,
  Diagnostic,
  NormalizedRequest,
  JsonValue,
  RandomContext,
  ParsedOperation,
} from "./expression_types.ts";

export interface Token {
  readonly kind: "number" | "identifier" | "operator" | "punctuation" | "eof";
  readonly text: string;
  readonly position: number;
}

export function lex(source: string): Token[] {
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
        source.slice(cursor),
      );
      if (!match)
        throw new ExpressionFailure(
          diagnostic("ERA_EXPR_LEX_INVALID_NUMBER", "无效数字。", {
            position: cursor,
          }),
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
        { position: cursor },
      ),
    );
  }
  tokens.push({ kind: "eof", text: "", position: cursor });
  return tokens;
}

export class Parser {
  private index = 0;
  constructor(
    private readonly tokens: readonly Token[],
    private readonly allowSnapshot: boolean,
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
          position: this.current().position,
        }),
      );
    return this.take();
  }
  parse(): Ast {
    const ast = this.additive();
    if (this.current().kind !== "eof")
      throw new ExpressionFailure(
        diagnostic("ERA_EXPR_PARSE_TRAILING", "表达式末尾存在未解析内容。", {
          position: this.current().position,
        }),
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
          "数字必须有限。",
        ),
      };
    }
    let snapshot = false;
    if (this.matches("@")) {
      if (!this.allowSnapshot)
        throw new ExpressionFailure(
          diagnostic(
            "ERA_EXPR_SNAPSHOT_FORBIDDEN",
            "用户原始表达式不能使用 @path。",
            { position: this.current().position },
          ),
        );
      this.take();
      snapshot = true;
    }
    if (this.current().kind !== "identifier")
      throw new ExpressionFailure(
        diagnostic("ERA_EXPR_PARSE_PRIMARY", "此处应为数字、变量或函数调用。", {
          position: this.current().position,
        }),
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
            position: segment.position,
          }),
        );
      path.push(this.take().text);
    }
    return { kind: "ref", path, snapshot };
  }
}

export function parseExpression(
  source: string,
  allowSnapshot = false,
): { readonly ast: Ast | null; readonly diagnostics: readonly Diagnostic[] } {
  try {
    return {
      ast: new Parser(lex(source), allowSnapshot).parse(),
      diagnostics: [],
    };
  } catch (error) {
    return {
      ast: null,
      diagnostics: [
        error instanceof ExpressionFailure
          ? error.detail
          : diagnostic("ERA_EXPR_PARSE_FAILED", String(error)),
      ],
    };
  }
}

export function validatePath(value: string): readonly string[] {
  const parts = value.split(".");
  if (
    parts.length === 0 ||
    parts.some((part) => !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(part))
  )
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_PATH_INVALID",
        `无效变量路径 ${JSON.stringify(value)}。`,
        { path: value },
      ),
    );
  return parts;
}

export function normaliseRequest(input: unknown): NormalizedRequest {
  const diagnostics: Diagnostic[] = [];
  const request = isRecord(input) ? input : {};
  const initialState = request.initialState;
  if (!isRecord(initialState))
    diagnostics.push(
      diagnostic(
        "ERA_EXPR_INITIAL_STATE_INVALID",
        "initialState 必须是 JSON 对象。",
      ),
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
        "snapshotState 必须是 JSON 对象。",
      ),
    );
  const functionLibrary = isRecord(request.functionLibrary)
    ? request.functionLibrary
    : {};
  if (
    request.functionLibrary !== undefined &&
    !isRecord(request.functionLibrary)
  )
    diagnostics.push(
      diagnostic("ERA_EXPR_LIBRARY_INVALID", "functionLibrary 必须是对象。"),
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
        "snapshotFunctionLibrary 必须是对象。",
      ),
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
          "randomContext 需要非空 sourceKey 与非负安全整数 drawOffset。",
        ),
      );
    else
      randomContext = {
        sourceKey: request.randomContext.sourceKey,
        drawOffset: request.randomContext.drawOffset as number,
      };
  }
  const rawOperations = Array.isArray(request.operations)
    ? request.operations
    : [];
  if (!Array.isArray(request.operations))
    diagnostics.push(
      diagnostic("ERA_EXPR_OPERATIONS_INVALID", "operations 必须是有序数组。"),
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
          `operations[${index}] 必须有 path 和 expr 字符串。`,
        ),
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
    valid: diagnostics.length === 0,
  };
}

export function walk(ast: Ast, visitor: (item: Ast) => void): void {
  visitor(ast);
  if (ast.kind === "unary") walk(ast.value, visitor);
  if (ast.kind === "binary") {
    walk(ast.left, visitor);
    walk(ast.right, visitor);
  }
  if (ast.kind === "call") for (const arg of ast.args) walk(arg, visitor);
}

export function parseOperations(
  request: NormalizedRequest,
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
          : diagnostic("ERA_EXPR_PATH_INVALID", String(error)),
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
      diagnostics: [...diagnostics, ...parsed.diagnostics],
    };
  });
}
