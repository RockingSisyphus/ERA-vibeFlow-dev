import { applySealedCommandCompactionToWork } from "../../base_lib/sync/command_compaction.ts";

/** Keep the full sealed-layer composition in Service and preserve the workflow contract. */
export function run(inputs: any): any {
  return {
    command_compaction_result: applySealedCommandCompactionToWork(inputs["era.expression.command.result"].value),
  };
}
