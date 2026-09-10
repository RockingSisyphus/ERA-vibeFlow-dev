import {
  NormalizedRequest,
  CompiledLibrary,
} from "../base_lib/expression_types.ts";
import { compileFunctionLibrary } from "../base_lib/expression_functions.ts";
import { initializeSequenceState } from "../base_lib/expression_execution.ts";

export function initializeSequenceStateNode(inputs: NodeInputs): any {
  const request = nodeInput<NormalizedRequest>(
    inputs,
    "era.expression.request.normalized",
  );
  const compiled = nodeInput<CompiledLibrary>(
    inputs,
    "era.expression.function_library.compiled",
  );
  const snapshotCompiled = request.snapshotFunctionLibrary
    ? compileFunctionLibrary(request.snapshotFunctionLibrary)
    : compiled;
  return {
    sequence_state: initializeSequenceState(
      request,
      compiled,
      nodeInput(inputs, "era.expression.operations.parsed"),
      snapshotCompiled,
    ),
  };
}

export { initializeSequenceStateNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
