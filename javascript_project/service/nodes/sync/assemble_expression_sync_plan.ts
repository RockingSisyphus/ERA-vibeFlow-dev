import { type SyncWorkV1 } from "../../base_lib/sync_contracts.ts";

function routeFor(work: SyncWorkV1): "no-op" | "crud" | "reconcile" {
  if (work.disposition !== "commit") return "no-op";
  return work.plan?.actionsTaken.apply === true ? "crud" : "reconcile";
}

export function run(inputs: any): any {
  const work = inputs["era.command_compaction.result"].value as SyncWorkV1;
  return {
    sync_route: routeFor(work),
    sync_work: work as unknown as Readonly<Record<string, unknown>>,
  };
}
