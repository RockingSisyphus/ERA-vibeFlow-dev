import { compileFunctionLibrary, executeExpressionLayer, type Diagnostic } from '@era/vibeflow-expression/engine';

/** 函数或变量表达式试算的纯内存结果，不含任何持久化回执。 */
export interface FunctionTrialResult {
  readonly ok: boolean;
  readonly value: number | null;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * 在当前状态副本上试用变量表达式。非标识符路径不能安全
 * 嵌入表达式操作，因此必须在进入引擎前明确拒绝。
 */
export function validateVariableExpression(
  expr: string,
  state: unknown,
  library: Readonly<Record<string, unknown>>,
  path: readonly string[],
): FunctionTrialResult {
  if (path.length === 0 || path.some(segment => !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(segment))) {
    return {
      ok: false,
      value: null,
      diagnostics: [
        {
          code: 'ERA_UI_EXPR_PATH',
          message: '表达式目标路径只能由英文标识符组成；其他键请使用直接值编辑。',
          path: path.join('.'),
        },
      ],
    };
  }
  const response = executeExpressionLayer({
    initialState: state,
    snapshotState: state,
    functionLibrary: library,
    snapshotFunctionLibrary: library,
    allowSnapshots: true,
    operations: [{ path: path.join('.'), expr }],
  });
  const finalState = response.finalState as Record<string, unknown>;
  let cursor: unknown = finalState;
  for (const segment of path) {
    cursor = cursor !== null && typeof cursor === 'object' ? (cursor as Record<string, unknown>)[segment] : undefined;
  }
  const value = typeof cursor === 'number' && Number.isFinite(cursor) ? cursor : null;
  return { ok: response.status === 'ok' && value !== null, value, diagnostics: response.diagnostics };
}

export function validateFunctionLibrary(library: Readonly<Record<string, unknown>>): readonly Diagnostic[] {
  return compileFunctionLibrary(library).diagnostics;
}

/**
 * 通过真实表达式引擎试算自定义函数，因为参数数量、递归与
 * 有限数结果必须和正式 commit 共用同一语义；试算不得写消息或 Sidecar。
 */
export function runFunctionTrial(
  name: string,
  args: readonly number[],
  library: Readonly<Record<string, unknown>>,
): FunctionTrialResult {
  if (!args.every(Number.isFinite)) {
    return {
      ok: false,
      value: null,
      diagnostics: [{ code: 'ERA_UI_TRIAL_ARGUMENT', message: '试算参数必须是有限数值。', path: name }],
    };
  }
  const response = executeExpressionLayer({
    initialState: { result: 0 },
    functionLibrary: library,
    operations: [{ path: 'result', expr: `${name}(${args.join(',')})` }],
  });
  const result = response.finalState as Record<string, unknown>;
  const value = typeof result.result === 'number' && Number.isFinite(result.result) ? result.result : null;
  return { ok: response.status === 'ok' && value !== null, value, diagnostics: response.diagnostics };
}
