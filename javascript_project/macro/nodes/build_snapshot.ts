import {
  buildMacroSnapshot,
  type MacroSnapshot,
  type MacroStoredStat,
} from "../base_lib/macro_runtime.ts";

interface Envelope<T> {
  readonly value: T;
}

interface BuildSnapshotInputs {
  readonly "era.macro.substring.checked": Envelope<string>;
  readonly "era.macro.stored_stat.checked": Envelope<MacroStoredStat>;
}

export function run(inputs: BuildSnapshotInputs): {
  readonly "macro.substring_for_replace": string;
  readonly "macro.snapshot": MacroSnapshot;
} {
  return {
    "macro.substring_for_replace":
      inputs["era.macro.substring.checked"].value,
    "macro.snapshot": buildMacroSnapshot(
      inputs["era.macro.stored_stat.checked"].value,
    ),
  };
}
