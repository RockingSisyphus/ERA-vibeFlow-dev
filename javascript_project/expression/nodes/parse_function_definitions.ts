import { parseFunctionDefinitions } from "../base_lib/expression_functions.ts";

export function parseFunctionDefinitionsNode(inputs: NodeInputs): any {
  return {
    parsed_function_library: parseFunctionDefinitions(
      nodeInput(inputs, "era.expression.request.normalized"),
    ),
  };
}

export { parseFunctionDefinitionsNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
