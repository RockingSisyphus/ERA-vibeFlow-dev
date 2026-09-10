import { compileCallableFunctions } from "../base_lib/expression_functions.ts";
import { ParsedFunction, Diagnostic } from "../base_lib/expression_types.ts";

export function compileCallableFunctionsNode(inputs: NodeInputs): any {
  return {
    compiled_function_library: compileCallableFunctions(
      nodeInput<readonly ParsedFunction[]>(
        inputs,
        "era.expression.function_library.parsed",
      ),
      nodeInput<{ diagnostics: readonly Diagnostic[] }>(
        inputs,
        "era.expression.function_library.acyclic_graph",
      ).diagnostics,
    ),
  };
}

export { compileCallableFunctionsNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
