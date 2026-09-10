import { executeOriginalSemantics } from "../base_lib/compaction_stages.ts";
import type { ParsedLayer } from "../base_lib/command_compaction_engine.ts";
export function run(
  inputs: Readonly<Record<string, { readonly value: unknown }>>,
) {
  return {
    trace: executeOriginalSemantics(
      inputs["era.command_compaction.parsed"].value as ParsedLayer,
    ),
  };
}
