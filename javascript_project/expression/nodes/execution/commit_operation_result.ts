import type { Diagnostic } from "../../base_lib/expression_types.ts";

import { SequenceState } from "../../base_lib/expression_types.ts";
import { commitOperationResult } from "../../base_lib/expression_operation.ts";

export function commitOperationResultNode(inputs: NodeInputs): any {
  const current = nodeInput<{ sequenceState: SequenceState }>(
    inputs,
    "era.expression.operation.current",
  );
  const evaluated = nodeValue(nodeInput(inputs, "era.expression.value"));
  const outcome = commitOperationResult(
    current.sequenceState,
    evaluated.value,
    evaluated.diagnostics,
  );
  return {
    sequence_state_next: outcome.sequenceStateNext,
    sequence_done: outcome.sequenceDone,
    operation_execution_result: outcome.operationExecutionResult,
  };
}

export { commitOperationResultNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
function nodeValue(value: unknown): {
  readonly value: number | null;
  readonly diagnostics: readonly Diagnostic[];
} {
  if (value !== null && typeof value === "object" && "value" in value) {
    const item = value as { value?: unknown; diagnostics?: unknown };
    return {
      value: typeof item.value === "number" ? item.value : null,
      diagnostics: Array.isArray(item.diagnostics)
        ? (item.diagnostics as Diagnostic[])
        : [],
    };
  }
  return { value: null, diagnostics: [] };
}
