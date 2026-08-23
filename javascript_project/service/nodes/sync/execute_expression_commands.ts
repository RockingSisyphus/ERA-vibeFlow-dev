import {
  planSyncWork,
  type SyncContextV1,
} from "../../base_lib/sync_transaction.ts";

/** Thin cross-root DTO adapter: command grammar and evaluation remain in @era/vibeflow-expression. */
export function run(inputs: any): any {
  const work = planSyncWork(
    inputs["era.expression.command.request"].value as SyncContextV1,
  );
  return { expression_command_result: work as unknown as Readonly<Record<string, unknown>> };
}
