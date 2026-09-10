import { initializeSegments } from "../base_lib/compaction_stages.ts";
import type { LayerPlan } from "../base_lib/compaction_stages.ts";
export function run(
  inputs: Readonly<Record<string, { readonly value: unknown }>>,
) {
  return {
    segment_state: initializeSegments(
      inputs["era.command_compaction.parsed"].value as LayerPlan,
    ),
  };
}
