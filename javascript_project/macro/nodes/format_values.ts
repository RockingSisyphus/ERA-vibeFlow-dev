import type { ResolvedMacroOccurrences } from "@era/vibeflow-contracts";
import {
  formatResolvedMacros,
} from "../base_lib/macro_runtime.ts";

interface Envelope<T> {
  readonly value: T;
}

interface FormatValuesInputs {
  readonly "era.macro.resolved_occurrences": Envelope<ResolvedMacroOccurrences>;
}

export function run(inputs: FormatValuesInputs): {
  readonly "macro.replacement.internal": string;
} {
  return {
    "macro.replacement.internal": formatResolvedMacros(
      inputs["era.macro.resolved_occurrences"].value,
    ),
  };
}
