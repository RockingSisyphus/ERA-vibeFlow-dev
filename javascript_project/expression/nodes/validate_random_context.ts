export function validateRandomContextNode(inputs: NodeInputs): any {
  return {
    validated_random_request: nodeInput(
      inputs,
      "era.expression.request.normalized",
    ),
  };
}

export { validateRandomContextNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
