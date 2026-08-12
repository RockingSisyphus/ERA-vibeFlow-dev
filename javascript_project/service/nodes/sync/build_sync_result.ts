import {
  buildSyncCommittedResult,
  buildSyncNonCommitResult,
  type SyncCommitResultV1,
  type SyncWorkV1,
} from "../../base_lib/sync_transaction.ts";

interface Envelope<T> {
  readonly value: T;
}

type CommitOutcome =
  | { readonly mode: "non-commit"; readonly work: SyncWorkV1 }
  | SyncCommitResultV1;

export function run(
  inputs: Readonly<{ "era.tavern.commit.result": Envelope<unknown> }>,
): any {
  const outcome = inputs["era.tavern.commit.result"].value as CommitOutcome;
  return {
    sync_task_result:
      "mode" in outcome && outcome.mode === "non-commit"
        ? buildSyncNonCommitResult(outcome.work)
        : buildSyncCommittedResult(outcome as SyncCommitResultV1),
  };
}
