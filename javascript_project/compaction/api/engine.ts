import { runWorkflow } from "../generated/release/workflow.js";
import type { CommandCompactionResponse } from "../base_lib/command_compaction_engine.ts";
export * from "../base_lib/command_compaction_engine.ts";

/** Public synchronous API; the registered workflow owns all orchestration. */
export function compactCommandLayer(input: unknown): CommandCompactionResponse {
  return runWorkflow({ compaction_request: input as Record<string, unknown> })
    .compactionResponse as unknown as CommandCompactionResponse;
}
