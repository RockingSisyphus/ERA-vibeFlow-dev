import { verifyLayer } from "../base_lib/compaction_stages.ts";
import type { SegmentState } from "../base_lib/compaction_stages.ts";
export function run(
  inputs: Readonly<Record<string, { readonly value: unknown }>>,
) {
  return {
    verified: verifyLayer(
      inputs["era.command_compaction.segment.state"].value as SegmentState,
    ),
  };
}
