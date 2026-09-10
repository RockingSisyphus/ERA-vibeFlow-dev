import { SequenceState, Diagnostic } from "../base_lib/expression_types.ts";
import { normaliseCompaction } from "../base_lib/expression_symbolic.ts";

export function normalizeCompactionNode(inputs: NodeInputs): any {
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
    expression_response: normaliseCompaction(
      completeNodeState(sequence, execution),
      nodeInput(inputs, "era.expression.symbolic.layer"),
    ),
  };
}

export { normalizeCompactionNode as run };

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
