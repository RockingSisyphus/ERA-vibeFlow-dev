import type { CommandCompactionResponse } from "../base_lib/command_compaction_engine.ts";
export function run(
  inputs: Readonly<Record<string, { readonly value: unknown }>>,
) {
  return {
    compaction_response: inputs["era.command_compaction.verified"]
      .value as CommandCompactionResponse,
  };
}
