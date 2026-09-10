import { SequenceState, Diagnostic } from "../base_lib/expression_types.ts";
import { deriveSymbolicLayer } from "../base_lib/expression_symbolic.ts";

export function deriveSymbolicLayerNode(inputs: NodeInputs): any {
  const sequence = nodeInput<SequenceState>(
    inputs,
    "era.expression.sequence.state",
  );
  const execution = nodeInput<{
    finalState: SequenceState["currentState"];
    diagnostics: readonly Diagnostic[];
    randomDrawsConsumed?: number;
  }>(inputs, "era.expression.execution.result");
  return {
    symbolic_layer: deriveSymbolicLayer(completeNodeState(sequence, execution)),
  };
}

export { deriveSymbolicLayerNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
function completeNodeState(
  initial: SequenceState,
  execution: {
    finalState: SequenceState["currentState"];
    diagnostics: readonly Diagnostic[];
    randomDrawsConsumed?: number;
  },
): SequenceState {
  return {
    ...initial,
    currentState: execution.finalState,
    diagnostics: execution.diagnostics,
    randomDrawsConsumed:
      execution.randomDrawsConsumed ?? initial.randomDrawsConsumed,
    cursor: initial.operations.length,
  };
}
