import {
  planSyncWork,
  type SyncContextV1,
} from "../../base_lib/sync_transaction.ts";

interface Envelope<T> { readonly value: T; }

/** Thin cross-root DTO adapter: command grammar and evaluation remain in @era/vibeflow-expression. */
export function run(inputs: Readonly<{ "era.expression.command.request": Envelope<unknown> }>): any {
  const work = planSyncWork(
    inputs["era.expression.command.request"].value as SyncContextV1,
  );
  return { expression_command_result: work as unknown as Readonly<Record<string, unknown>> };
}
