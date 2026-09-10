export function guardRandomCompactionNode(inputs: NodeInputs): any {
  return {
    random_guarded_symbolic_layer: nodeInput(
      inputs,
      "era.expression.symbolic.layer",
    ),
  };
}

export { guardRandomCompactionNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
