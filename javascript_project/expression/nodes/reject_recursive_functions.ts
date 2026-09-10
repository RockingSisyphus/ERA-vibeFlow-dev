import { Diagnostic } from "../base_lib/expression_types.ts";
import { rejectRecursiveFunctions } from "../base_lib/expression_functions.ts";

export function rejectRecursiveFunctionsNode(inputs: NodeInputs): any {
  const graph = nodeInput<{
    dependencies: Readonly<Record<string, readonly string[]>>;
    diagnostics: readonly Diagnostic[];
  }>(inputs, "era.expression.function_library.call_graph");
  return {
    acyclic_function_graph: {
      dependencies: graph.dependencies,
      diagnostics: [
        ...graph.diagnostics,
        ...rejectRecursiveFunctions(graph.dependencies),
      ],
    },
  };
}

export { rejectRecursiveFunctionsNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
