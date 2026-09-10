import { parseLayer } from "../base_lib/compaction_stages.ts";
export function run(
  inputs: Readonly<Record<string, { readonly value: unknown }>>,
) {
  return { parsed: parseLayer(inputs["era.command_compaction.request"].value) };
}
