import { Ast, SequenceState, ExpressionResponse } from "./expression_types.ts";
import { walk } from "./expression_syntax.ts";
import { countAutomaticRandomDraws } from "./expression_functions.ts";
import { getPath } from "./expression_primitives.ts";

export function substituteSymbolic(
  ast: Ast,
  state: Readonly<Record<string, Ast>>,
): Ast {
  if (ast.kind === "literal") return ast;
  if (ast.kind === "ref")
    return (
      state[ast.path.join(".")] ?? {
        kind: "ref",
        path: ast.path,
        snapshot: true,
      }
    );
  if (ast.kind === "unary")
    return simplify({
      kind: "unary",
      op: ast.op,
      value: substituteSymbolic(ast.value, state),
    });
  if (ast.kind === "binary")
    return simplify({
      kind: "binary",
      op: ast.op,
      left: substituteSymbolic(ast.left, state),
      right: substituteSymbolic(ast.right, state),
    });
  return {
    kind: "call",
    name: ast.name,
    args: ast.args.map((arg) => substituteSymbolic(arg, state)),
    snapshot: ast.snapshot,
  };
}

export function literal(value: number): Ast {
  return { kind: "literal", value: Object.is(value, -0) ? 0 : value };
}

export function literalNumber(ast: Ast): number | undefined {
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
        right: literal(nested + rightNumber),
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
        right: literal(subtraction - rightNumber),
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
        right: literal(nested + rightNumber),
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
        right: literal(addition - rightNumber),
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

export function operatorPrecedence(
  op: Extract<Ast, { kind: "binary" }>["op"],
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
  sequence: SequenceState,
): Readonly<Record<string, Ast>> {
  const symbols: Record<string, Ast> = {};
  const tainted = new Set<string>();
  const conflicts = (left: string, right: string): boolean =>
    left === right ||
    left.startsWith(`${right}.`) ||
    right.startsWith(`${left}.`);
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
        sequence.snapshotCompiled,
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
  symbols: Readonly<Record<string, Ast>>,
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
      value,
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
          sequence.snapshotCompiled,
        ) > 0,
    ),
  };
}
