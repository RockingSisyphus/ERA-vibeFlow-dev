import {
  planSyncWork,
  type SyncContextV1,
  type SyncWorkV1,
} from "../../base_lib/sync_transaction.ts";

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
    inputs["era.sync.context"].value as SyncContextV1,
  );
  return {
    sync_route: routeFor(work),
    sync_work: work as unknown as Readonly<Record<string, unknown>>,
  };
}
