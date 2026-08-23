import {
  applySealedCommandCompactionToWork,
} from "../../base_lib/command_compaction.ts";
import type { SyncWorkV1 } from "../../base_lib/sync_transaction.ts";

/** Thin Nodeset bridge: compaction proof lives in the published compaction root. */
export function run(inputs: any): any {
  return {
    command_compaction_result: applySealedCommandCompactionToWork(
      inputs["era.expression.command.result"].value as SyncWorkV1,
    ) as unknown as Record<string, unknown>,
  };
}
