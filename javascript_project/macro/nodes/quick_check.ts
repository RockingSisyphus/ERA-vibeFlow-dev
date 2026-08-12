import {
  containsEraMacro,
  type MacroStoredStat,
} from "../base_lib/macro_runtime.ts";

interface Envelope<T> {
  readonly value: T;
}

interface QuickCheckInputs {
  readonly "era.macro.substring": Envelope<string>;
  readonly "era.macro.stored_stat": Envelope<MacroStoredStat>;
}

export function run(inputs: QuickCheckInputs): {
  readonly "macro.checked_substring": string;
  readonly "macro.checked_stored_stat": MacroStoredStat;
  readonly "macro.contains": boolean;
} {
  const substring = inputs["era.macro.substring"].value;
  return {
    "macro.checked_substring": substring,
    "macro.checked_stored_stat": inputs["era.macro.stored_stat"].value,
    "macro.contains": containsEraMacro(substring),
  };
}
