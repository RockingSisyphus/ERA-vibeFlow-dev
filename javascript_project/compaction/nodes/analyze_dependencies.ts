import { analyzeDependencies } from "../base_lib/compaction_stages.ts";
import type { SemanticTrace } from "../base_lib/command_compaction_engine.ts";
export function run(
  inputs: Readonly<Record<string, { readonly value: unknown }>>,
) {
  return {
    symbols: analyzeDependencies(
      inputs["era.command_compaction.semantic_trace"].value as SemanticTrace,
    ),
  };
}
