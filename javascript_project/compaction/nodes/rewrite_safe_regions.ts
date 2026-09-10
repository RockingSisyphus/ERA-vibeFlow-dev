import { rewriteSegment } from "../base_lib/compaction_stages.ts";
import type { DependencyAnalysis } from "../base_lib/command_compaction_engine.ts";
export function run(
  inputs: Readonly<Record<string, { readonly value: unknown }>>,
) {
  return {
    candidate: rewriteSegment(
      inputs["era.command_compaction.symbols"].value as DependencyAnalysis,
    ),
  };
}
