import {
  advanceSegment,
  type SegmentState,
} from "../base_lib/compaction_stages.ts";
import type { CommandCompactionResponse } from "../base_lib/command_compaction_engine.ts";
export function run(
  inputs: Readonly<Record<string, { readonly value: unknown }>>,
) {
  const next = advanceSegment(
    inputs["era.command_compaction.segment.state.before"].value as SegmentState,
    inputs["era.command_compaction.verified"]
      .value as CommandCompactionResponse,
  );
  return {
    segment_state_next: next,
    segment_done: next.cursor >= next.segments.length,
  };
}
