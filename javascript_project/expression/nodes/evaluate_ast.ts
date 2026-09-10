import { evaluateAst } from "../base_lib/expression_execution.ts";
import type { AstFrameState } from "../base_lib/expression_types.ts";
export function run(inputs: Readonly<Record<string, unknown>>): any {
  const envelope = inputs["era.expression.ast_frame.state"] as {
    value: AstFrameState;
  };
  return { evaluated_expression: evaluateAst(envelope.value) };
}
