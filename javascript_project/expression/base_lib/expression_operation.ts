import { type SequenceState, type AstFrameState, type JsonValue, type Diagnostic } from "./expression_types.ts";
import { setPath } from "./expression_primitives.ts";
import { countAutomaticRandomDraws } from "./expression_functions.ts";
import { createAstFrameState } from "./expression_execution_core.ts";
import { advanceAstFrame } from "./expression_execution.ts";
export function runOperationStep(
  state: SequenceState,
): ReturnType<typeof commitOperationResult> {
  const operation = state.operations[state.cursor];
  if (
    !state.compiled.valid ||
    !operation?.ast ||
    operation.diagnostics.length > 0
  )
    return commitOperationResult(state, null, []);
  const result = evaluateAst(createAstFrameState(state, operation.ast));
  return commitOperationResult(state, result.value, result.diagnostics);
}

export function commitOperationResult(
  state: SequenceState,
  value: number | null,
  evaluationDiagnostics: readonly Diagnostic[],
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
        randomDrawsConsumed: state.randomDrawsConsumed,
      },
    };
  const diagnostics = [
    ...state.diagnostics,
    ...operation.diagnostics,
    ...evaluationDiagnostics,
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
          state.snapshotCompiled,
        )
      : 0;
  const next: SequenceState = {
    ...state,
    currentState,
    cursor: state.cursor + 1,
    randomDrawsConsumed: state.randomDrawsConsumed + randomDraws,
    diagnostics,
  };
  return {
    sequenceStateNext: next,
    sequenceDone: next.cursor >= next.operations.length,
    operationExecutionResult: {
      finalState: next.currentState,
      diagnostics: next.diagnostics,
      randomDrawsConsumed: next.randomDrawsConsumed,
    },
  };
}

/** Evaluate one initialized AST; operation ordering and state commits belong to the workflow. */
export function evaluateAst(state: AstFrameState): {
  readonly value: number | null;
  readonly diagnostics: readonly Diagnostic[];
} {
  let frame = state;
  while (!frame.done) frame = advanceAstFrame(frame);
  return { value: frame.result, diagnostics: frame.diagnostics };
}
