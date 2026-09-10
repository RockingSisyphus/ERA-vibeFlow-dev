import { validateFunctionPurity } from "../base_lib/expression_functions.ts";
import { ParsedFunction } from "../base_lib/expression_types.ts";

export function validateFunctionPurityNode(inputs: NodeInputs): any {
  return {
    function_purity_report: {
      diagnostics: validateFunctionPurity(
        nodeInput<readonly ParsedFunction[]>(
          inputs,
          "era.expression.function_library.parsed",
        ),
      ),
    },
  };
}

export { validateFunctionPurityNode as run };

type NodeInputs = Readonly<Record<string, unknown>>;
function nodeInput<T>(inputs: NodeInputs, key: string): T {
  const item = inputs[key];
  return item !== null && typeof item === "object" && "value" in item
    ? ((item as { value: unknown }).value as T)
    : (item as T);
}
