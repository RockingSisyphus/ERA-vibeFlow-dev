import { derivative, evaluate as mathEvaluate } from "mathjs/number";
import { CompiledLibrary, Ast, AstFrameState, SequenceState } from "./expression_types.ts";
import { ExpressionFailure, diagnostic, finite, isBuiltin, calculateBuiltin, calculateRandom } from "./expression_primitives.ts";
import { createAstFrameState, refValue, popValues, inlineCustomAst, mathText, complete, astFrameRoute } from "./expression_execution_core.ts";
export { initializeSequenceState, createAstFrameState, refValue, popValues, inlineCustomAst, mathText, complete, astFrameRoute } from "./expression_execution_core.ts";
export function evaluateFunctionAt(
  library: CompiledLibrary,
  name: string,
  input: number,
): number {
  const target = library.functions[name];
  if (!target || !target.ast || target.params.length !== 1)
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_CALCULUS_TARGET",
        `${name} 必须是已定义的一元纯函数。`,
        { path: name },
      ),
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
    diagnostics: [],
  };
  let frame = createAstFrameState(
    sequence,
    target.ast,
    { [target.params[0]!]: input },
    false,
  );
  while (!frame.done) frame = advanceAstFrame(frame);
  if (frame.diagnostics.length > 0 || frame.result === null)
    throw new ExpressionFailure(
      frame.diagnostics[0] ??
        diagnostic("ERA_EXPR_CALCULUS_EVALUATE", `函数 ${name} 无法求值。`, {
          path: name,
        }),
    );
  return frame.result;
}

export function calculateCalculus(
  name: "derivative" | "integral",
  target: string,
  args: readonly number[],
  library: CompiledLibrary,
): number {
  const functionDef = library.functions[target];
  if (!functionDef || !functionDef.ast || functionDef.params.length !== 1)
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_CALCULUS_TARGET",
        `${name} 只接受已定义的一元纯函数。`,
        { path: target },
      ),
    );
  if (library.randomFunctions.includes(target))
    throw new ExpressionFailure(
      diagnostic(
        "ERA_EXPR_CALCULUS_RANDOM_FORBIDDEN",
        `${name} 不能以直接或间接调用 random 的函数为目标。`,
        { path: target },
      ),
    );
  if (name === "derivative") {
    if (args.length !== 1 && args.length !== 2)
      throw new ExpressionFailure(
        diagnostic(
          "ERA_EXPR_BUILTIN_ARITY",
          "derivative 需要 f、at 与可选 order。",
        ),
      );
    const order = args.length === 2 ? args[1]! : 1;
    if (!Number.isSafeInteger(order) || order <= 0)
      throw new ExpressionFailure(
        diagnostic(
          "ERA_EXPR_DERIVATIVE_ORDER",
          "导数阶数必须是任意正安全整数。",
        ),
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
        "导数产生了非有限结果。",
      );
    } catch (error) {
      throw new ExpressionFailure(
        diagnostic(
          "ERA_EXPR_DERIVATIVE_UNSUPPORTED",
          `无法构造该导数：${error instanceof Error ? error.message : String(error)}。`,
          { path: target },
        ),
      );
    }
  }
  if (args.length !== 2)
    throw new ExpressionFailure(
      diagnostic("ERA_EXPR_BUILTIN_ARITY", "integral 需要 f、start、end。"),
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
    fb: number,
  ): number => ((b - a) / 6) * (fa + 4 * fm + fb);
  const middle = (left + right) / 2;
  const whole = simpson(
    left,
    right,
    evaluate(left),
    evaluate(middle),
    evaluate(right),
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
      tolerance: 1e-9,
    },
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
          { path: target },
        ),
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
      segment.fb,
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
      tolerance: segment.tolerance / 2,
    });
    stack.push({
      a: segment.a,
      b: mid,
      fa: segment.fa,
      fm: leftValue,
      fb: segment.fm,
      whole: leftArea,
      tolerance: segment.tolerance / 2,
    });
  }
  return finite(
    direction * sum,
    "ERA_EXPR_INTEGRAL_NON_FINITE",
    "积分产生了非有限结果。",
  );
}

export function advanceAstFrame(
  state: AstFrameState,
  expected?: ReturnType<typeof astFrameRoute>,
): AstFrameState {
  if (state.done) return state;
  try {
    const actual = astFrameRoute(state);
    if (expected && actual !== expected)
      throw new ExpressionFailure(
        diagnostic(
          "ERA_EXPR_FRAME_ROUTE",
          `调用帧路由不匹配：期望 ${expected}，实际 ${actual}。`,
        ),
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
            library: top.library,
          },
        );
      } else if (top.ast.kind === "binary") {
        stack.push(
          { kind: "binary", op: top.ast.op },
          {
            kind: "eval",
            ast: top.ast.right,
            env: top.env,
            allowState: top.allowState,
            library: top.library,
          },
          {
            kind: "eval",
            ast: top.ast.left,
            env: top.env,
            allowState: top.allowState,
            library: top.library,
          },
        );
      } else if (top.ast.kind === "call") {
        if (top.ast.name === "derivative" || top.ast.name === "integral") {
          if (top.ast.snapshot)
            throw new ExpressionFailure(
              diagnostic(
                "ERA_EXPR_SNAPSHOT_FUNCTION_REQUIRED",
                "@ 仅可用于自定义函数调用。",
              ),
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
                `${top.ast.name} 的首参必须是已定义函数名。`,
              ),
            );
          stack.push({
            kind: "calculus",
            name: top.ast.name,
            target: targetAst.path[0]!,
            count: top.ast.args.length - 1,
            library: top.library,
          });
          for (const arg of [...top.ast.args.slice(1)].reverse())
            stack.push({
              kind: "eval",
              ast: arg,
              env: top.env,
              allowState: top.allowState,
              library: top.library,
            });
        } else if (top.ast.name === "random") {
          if (top.ast.snapshot)
            throw new ExpressionFailure(
              diagnostic(
                "ERA_EXPR_SNAPSHOT_FUNCTION_REQUIRED",
                "@ 仅可用于自定义函数调用。",
              ),
            );
          stack.push({ kind: "random", count: top.ast.args.length });
          for (const arg of [...top.ast.args].reverse())
            stack.push({
              kind: "eval",
              ast: arg,
              env: top.env,
              allowState: top.allowState,
              library: top.library,
            });
        } else if (isBuiltin(top.ast.name)) {
          if (top.ast.snapshot)
            throw new ExpressionFailure(
              diagnostic(
                "ERA_EXPR_SNAPSHOT_FUNCTION_REQUIRED",
                "@ 仅可用于自定义函数调用。",
              ),
            );
          stack.push({
            kind: "builtin",
            name: top.ast.name,
            count: top.ast.args.length,
          });
          for (const arg of [...top.ast.args].reverse())
            stack.push({
              kind: "eval",
              ast: arg,
              env: top.env,
              allowState: top.allowState,
              library: top.library,
            });
        } else {
          stack.push({
            kind: "custom",
            name: top.ast.name,
            count: top.ast.args.length,
            library: top.ast.snapshot
              ? state.sequence.snapshotCompiled
              : top.library,
          });
          for (const arg of [...top.ast.args].reverse())
            stack.push({
              kind: "eval",
              ast: arg,
              env: top.env,
              allowState: top.allowState,
              library: top.library,
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
          "一元运算产生了非有限结果。",
        ),
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
          "二元运算产生了非有限结果。",
        ),
      );
    } else if (top.kind === "builtin") {
      const popped = popValues(values, top.count);
      values.splice(
        0,
        values.length,
        ...popped.values,
        calculateBuiltin(top.name, popped.args),
      );
    } else if (top.kind === "random") {
      const popped = popValues(values, top.count);
      const draw = automaticRandomDrawCursor;
      if (top.count < 2) automaticRandomDrawCursor += 1;
      values.splice(
        0,
        values.length,
        ...popped.values,
        calculateRandom(popped.args, state.sequence.randomContext, draw),
      );
    } else if (top.kind === "calculus") {
      const popped = popValues(values, top.count);
      values.splice(
        0,
        values.length,
        ...popped.values,
        calculateCalculus(top.name, top.target, popped.args, top.library),
      );
    } else {
      const popped = popValues(values, top.count);
      const target = top.library.functions[top.name];
      if (!target || !target.ast)
        throw new ExpressionFailure(
          diagnostic(
            "ERA_EXPR_FUNCTION_UNKNOWN_CALL",
            `未知函数 ${top.name}。`,
            { path: top.name },
          ),
        );
      if (target.params.length !== popped.args.length)
        throw new ExpressionFailure(
          diagnostic(
            "ERA_EXPR_FUNCTION_ARITY",
            `函数 ${top.name} 实参数不匹配。`,
            { path: top.name },
          ),
        );
      const env = Object.fromEntries(
        target.params.map((param, index) => [param, popped.args[index]!]),
      ) as Record<string, number>;
      values.splice(0, values.length, ...popped.values);
      stack.push({
        kind: "eval",
        ast: target.ast,
        env,
        allowState: false,
        library: top.library,
      });
    }
    return complete({ ...state, stack, values, automaticRandomDrawCursor });
  } catch (error) {
    const detail =
      error instanceof ExpressionFailure
        ? error.detail
        : diagnostic(
            "ERA_EXPR_EVALUATION_FAILED",
            error instanceof Error ? error.message : String(error),
          );
    return {
      ...state,
      stack: [],
      done: true,
      result: null,
      diagnostics: [...state.diagnostics, detail],
    };
  }
}

/** Standalone operation API reuses the same evaluator and commit policy as Nodes. */
