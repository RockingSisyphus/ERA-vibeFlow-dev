import { SequenceState, Ast } from "../../base_lib/expression_types.ts";
import { createAstFrameState } from "../../base_lib/expression_execution.ts";

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

export { initializeAstFramesNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
