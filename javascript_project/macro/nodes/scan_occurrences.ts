import type { MacroOccurrencePlan, MacroSnapshot } from "@era/vibeflow-contracts";
import {
  scanMacroOccurrences,
} from "../base_lib/macro_runtime.ts";

interface Envelope<T> {
  readonly value: T;
}

interface ScanOccurrencesInputs {
  readonly "era.macro.substring.for_replace": Envelope<string>;
  readonly "era.macro.snapshot": Envelope<unknown>;
}

export function run(inputs: ScanOccurrencesInputs): {
  readonly "macro.occurrence_plan": MacroOccurrencePlan;
} {
  return {
    "macro.occurrence_plan": scanMacroOccurrences(
      inputs["era.macro.substring.for_replace"].value,
      inputs["era.macro.snapshot"].value as MacroSnapshot,
    ),
  };
}
