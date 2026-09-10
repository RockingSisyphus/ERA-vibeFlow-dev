import gamma from "@stdlib/math-base-special-gamma";
import { Diagnostic, JsonValue, RandomContext } from "./expression_types.ts";

export function isBuiltin(name: string): boolean {
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
    "random",
  ].includes(name);
}

export function diagnostic(
  code: string,
  message: string,
  extra: Partial<Diagnostic> = {},
): Diagnostic {
  return { code, message, ...extra };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function clone<T extends JsonValue>(value: T): T {
  return structuredClone(value);
}

export function finite(value: number, code: string, message: string): number {
  if (!Number.isFinite(value))
    throw new ExpressionFailure(diagnostic(code, message));
  return Object.is(value, -0) ? 0 : value;
}

export class ExpressionFailure extends Error {
  constructor(readonly detail: Diagnostic) {
    super(detail.message);
  }
}

export function getPath(
  root: JsonValue,
  path: readonly string[],
): JsonValue | undefined {
  let value: JsonValue | undefined = root;
  for (const segment of path) {
    if (!isRecord(value) || !(segment in value)) return undefined;
    value = value[segment] as JsonValue;
  }
  return value;
}

export function setPath(
  root: JsonValue,
  path: readonly string[],
  value: JsonValue,
): JsonValue {
  if (!isRecord(root))
    throw new ExpressionFailure(
      diagnostic("ERA_EXPR_STATE_ROOT", "变量状态根必须是对象。"),
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

export const UINT64_MASK = (1n << 64n) - 1n;

export const FNV64_OFFSET = 0xcbf29ce484222325n;

export const FNV64_PRIME = 0x100000001b3n;

export const SPLITMIX_GAMMA = 0x9e3779b97f4a7c15n;

export const SPLITMIX_MUL_1 = 0xbf58476d1ce4e5b9n;

export const SPLITMIX_MUL_2 = 0x94d049bb133111ebn;

export const TWO_POW_53 = 9007199254740992;

export function fnv1a64(bytes: Uint8Array): bigint {
  return bytes.reduce(
    (hash, byte) => ((hash ^ BigInt(byte)) * FNV64_PRIME) & UINT64_MASK,
    FNV64_OFFSET,
  );
}

export function randomSeedHash(seed: string | number): bigint {
  if (typeof seed === "string") return fnv1a64(new TextEncoder().encode(seed));
  const normalized = Object.is(seed, -0) ? 0 : seed;
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setFloat64(0, normalized, true);
  return fnv1a64(new Uint8Array(buffer));
}

export function deterministicRandomUnit(
  seed: string | number,
  draw: number,
): number {
  if (
    (typeof seed === "number" && !Number.isFinite(seed)) ||
    !Number.isSafeInteger(draw) ||
    draw < 0
  )
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_RANDOM_DRAW_INVALID",
        "random 的 seed 必须有限，draw 必须是非负安全整数。",
      ),
    );
  const mixed0 =
    (randomSeedHash(seed) + BigInt(draw) + SPLITMIX_GAMMA) & UINT64_MASK;
  const mixed1 = ((mixed0 ^ (mixed0 >> 30n)) * SPLITMIX_MUL_1) & UINT64_MASK;
  const mixed2 = ((mixed1 ^ (mixed1 >> 27n)) * SPLITMIX_MUL_2) & UINT64_MASK;
  const mixed3 = mixed2 ^ (mixed2 >> 31n);
  return Number((mixed3 & UINT64_MASK) >> 11n) / TWO_POW_53;
}

export function calculateRandom(
  args: readonly number[],
  context: RandomContext | null,
  automaticDraw: number,
): number {
  if (args.length > 2)
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_BUILTIN_ARITY",
        "random 只接受零个、一个或两个参数。",
      ),
    );
  if (args.length < 2 && !context)
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_RANDOM_CONTEXT_REQUIRED",
        "random() 与 random(seed) 需要消息随机上下文。",
      ),
    );
  const seed = args.length === 0 ? context!.sourceKey : args[0]!;
  const draw = args.length === 2 ? args[1]! : automaticDraw;
  if (!Number.isSafeInteger(draw) || draw < 0)
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_RANDOM_DRAW_INVALID",
        "random 的 draw 必须是非负安全整数。",
      ),
    );
  return deterministicRandomUnit(seed, draw);
}

export function calculateBuiltin(
  name: string,
  args: readonly number[],
): number {
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
    gamma,
  };
  if (name in unary) {
    if (args.length !== 1)
      throw new ExpressionFailure(
        diagnostic("ERA_EXPR_BUILTIN_ARITY", `${name} 需要一个参数。`),
      );
    return finite(
      unary[name]!(args[0]!),
      "ERA_EXPR_BUILTIN_NON_FINITE",
      `${name} 产生了非有限结果。`,
    );
  }
  if (name === "factorial") {
    if (args.length !== 1 || !Number.isSafeInteger(args[0]!) || args[0]! < 0)
      throw new ExpressionFailure(
        diagnostic(
          "ERA_EXPR_FACTORIAL_DOMAIN",
          "factorial 只接受非负安全整数。",
        ),
      );
    let result = 1;
    for (let value = 2; value <= args[0]!; value += 1)
      result = finite(
        result * value,
        "ERA_EXPR_FACTORIAL_NON_FINITE",
        "factorial 产生了非有限结果。",
      );
    return result;
  }
  if (name === "min" || name === "max") {
    if (args.length === 0)
      throw new ExpressionFailure(
        diagnostic("ERA_EXPR_BUILTIN_ARITY", `${name} 至少需要一个参数。`),
      );
    return name === "min" ? Math.min(...args) : Math.max(...args);
  }
  if (name === "clamp") {
    if (args.length !== 3)
      throw new ExpressionFailure(
        diagnostic("ERA_EXPR_BUILTIN_ARITY", "clamp 需要三个参数。"),
      );
    return Math.min(Math.max(args[0]!, args[1]!), args[2]!);
  }
  if (name === "pow" || name === "mod") {
    if (args.length !== 2)
      throw new ExpressionFailure(
        diagnostic("ERA_EXPR_BUILTIN_ARITY", `${name} 需要两个参数。`),
      );
    return finite(
      name === "pow" ? args[0]! ** args[1]! : args[0]! % args[1]!,
      "ERA_EXPR_BUILTIN_NON_FINITE",
      `${name} 产生了非有限结果。`,
    );
  }
  throw new ExpressionFailure(
    diagnostic("ERA_EXPR_BUILTIN_UNKNOWN", `未知内建函数 ${name}。`),
  );
}
