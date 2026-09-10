import { planSyncWork } from "../../base_lib/sync_planning.ts";
import { type SyncPlanningInput } from "../../base_lib/sync_contracts.ts";

/** Thin cross-root DTO adapter: command grammar and evaluation remain in @era/vibeflow-expression. */
export function run(inputs: any): any {
  const work = planSyncWork(
    inputs["era.expression.command.request"].value as SyncPlanningInput,
  );
  return { expression_command_result: work as unknown as Readonly<Record<string, unknown>> };
}
