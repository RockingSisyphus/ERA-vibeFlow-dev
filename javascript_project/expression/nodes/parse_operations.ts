import { parseOperations } from "../base_lib/expression_syntax.ts";

export function parseOperationsNode(inputs: NodeInputs): any {
  return {
    parsed_operations: parseOperations(
      nodeInput(inputs, "era.expression.request.normalized"),
    ),
  };
}

export { parseOperationsNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
