import {
  resolveMacroOccurrences,
  type MacroOccurrencePlan,
  type ResolvedMacroOccurrences,
} from "../base_lib/macro_runtime.ts";

interface Envelope<T> {
  readonly value: T;
}

interface ResolveOccurrencesInputs {
  readonly "era.macro.occurrence_plan": Envelope<unknown>;
}

export function run(inputs: ResolveOccurrencesInputs): {
  readonly "macro.resolved_occurrences": ResolvedMacroOccurrences;
} {
  return {
    "macro.resolved_occurrences": resolveMacroOccurrences(
      inputs["era.macro.occurrence_plan"].value as MacroOccurrencePlan,
    ),
  };
}
