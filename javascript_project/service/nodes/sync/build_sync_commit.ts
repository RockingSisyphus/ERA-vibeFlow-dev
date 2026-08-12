import {
  buildSyncCommitRequest,
  type SyncWorkV1,
} from "../../base_lib/sync_transaction.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(
  inputs: Readonly<{ "era.sync.logical_result": Envelope<unknown> }>,
): any {
  const work = inputs["era.sync.logical_result"].value as SyncWorkV1;
  const request =
    work.disposition === "commit"
      ? { mode: "commit" as const, request: buildSyncCommitRequest(work) }
      : { mode: "non-commit" as const, work };
  return {
    sync_commit_request: request as unknown as Readonly<Record<string, unknown>>,
  };
}
