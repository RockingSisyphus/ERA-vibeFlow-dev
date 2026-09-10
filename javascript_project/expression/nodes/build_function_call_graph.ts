import { Diagnostic } from "../base_lib/expression_types.ts";

export function buildFunctionCallGraphNode(inputs: NodeInputs): any {
  const dependencies = nodeInput<Readonly<Record<string, readonly string[]>>>(
    inputs,
    "era.expression.function_library.dependencies",
  );
  const purity = nodeInput<{ diagnostics: readonly Diagnostic[] }>(
    inputs,
    "era.expression.function_library.purity",
  );
  return {
    function_call_graph: { dependencies, diagnostics: purity.diagnostics },
  };
}

export { buildFunctionCallGraphNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
