import { SequenceState } from "../base_lib/expression_types.ts";

export function selectNextOperationNode(inputs: NodeInputs): any {
  const sequenceState = nodeInput<SequenceState>(
    inputs,
    "era.expression.sequence.state",
  );
  return {
    current_operation: {
      sequenceState,
      operation: sequenceState.operations[sequenceState.cursor] ?? null,
    },
  };
}

export { selectNextOperationNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
