import {
  selectSegment,
  type SegmentState,
} from "../base_lib/compaction_stages.ts";
export function run(
  inputs: Readonly<Record<string, { readonly value: unknown }>>,
) {
  const state = inputs["era.command_compaction.segment.state"]
    .value as SegmentState;
  return { parsed: selectSegment(state), segment_state_before: state };
}
