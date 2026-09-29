import { runWorkflow } from "../generated/release/workflow.js";
import type { ExpressionResponse } from "../base_lib/expression_types.ts";
export function executeExpressionLayer(input: unknown): ExpressionResponse {
  return runWorkflow({ expression_request: input ?? null }, { trace: "off" })
    .expressionResponse as unknown as ExpressionResponse;
}
export {
  JsonValue,
  Diagnostic,
  Ast,
  ParsedFunction,
  CompiledLibrary,
  RandomContext,
  ParsedOperation,
  NormalizedRequest,
  SequenceState,
  ExpressionResponse,
  AstFrameState,
} from "../base_lib/expression_types.ts";
export {
  parseExpression,
  normaliseRequest,
  parseOperations,
} from "../base_lib/expression_syntax.ts";
export {
  parseFunctionDefinitions,
  extractFunctionDependencies,
  validateFunctionPurity,
  rejectRecursiveFunctions,
  compileCallableFunctions,
  compileFunctionLibrary,
  countAutomaticRandomDraws,
  containsAnyRandomCall,
} from "../base_lib/expression_functions.ts";
export {
  initializeSequenceState,
  createAstFrameState,
  astFrameRoute,
  advanceAstFrame,
} from "../base_lib/expression_execution.ts";
export { runOperationStep, commitOperationResult, evaluateAst } from "../base_lib/expression_operation.ts";
export { deterministicRandomUnit } from "../base_lib/expression_primitives.ts";
export {
  simplify,
  printAst,
  deriveSymbolicLayer,
  normaliseCompaction,
} from "../base_lib/expression_symbolic.ts";
