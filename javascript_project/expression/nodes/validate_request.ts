import { normaliseRequest } from "../base_lib/expression_syntax.ts";

export function validateRequestNode(inputs: NodeInputs): any {
  return {
    normalized_expression_request: normaliseRequest(
      nodeInput(inputs, "era.expression.request"),
    ),
  };
}

export { validateRequestNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
