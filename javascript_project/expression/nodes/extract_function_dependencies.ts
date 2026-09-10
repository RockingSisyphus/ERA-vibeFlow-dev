import { extractFunctionDependencies } from "../base_lib/expression_functions.ts";

export function extractFunctionDependenciesNode(inputs: NodeInputs): any {
  return {
    function_dependencies: extractFunctionDependencies(
      nodeInput(inputs, "era.expression.function_library.parsed"),
    ),
  };
}

export { extractFunctionDependenciesNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
