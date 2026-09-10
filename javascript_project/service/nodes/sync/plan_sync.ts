import { planSyncWork } from "../../base_lib/sync_planning.ts";
import { type SyncPlanningInput, type SyncWorkV1 } from "../../base_lib/sync_contracts.ts";

interface Envelope<T> {
  readonly value: T;
}

function routeFor(work: SyncWorkV1): "no-op" | "crud" | "reconcile" {
  if (work.disposition !== "commit") return "no-op";
  return work.plan?.actionsTaken.apply === true ? "crud" : "reconcile";
}

export function run(
  inputs: Readonly<{ "era.sync.context": Envelope<unknown> }>,
): any {
  const work = planSyncWork(
    inputs["era.sync.context"].value as SyncPlanningInput,
  );
  return {
    sync_route: routeFor(work),
    sync_work: work as unknown as Readonly<Record<string, unknown>>,
  };
}
