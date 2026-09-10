import { verifySegment } from "../base_lib/compaction_stages.ts";
import type { CandidateData } from "../base_lib/compaction_stages.ts";
export function run(
  inputs: Readonly<Record<string, { readonly value: unknown }>>,
) {
  return {
    verified: verifySegment(
      inputs["era.command_compaction.candidate"].value as CandidateData,
    ),
  };
}
