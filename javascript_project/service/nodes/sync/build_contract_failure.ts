import {
  buildSyncContractFailureResult,
  type SyncCommitContractFailureV1,
} from "../../base_lib/sync_transaction.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(
  inputs: Readonly<{ "era.sync.commit.contract.failure": Envelope<unknown> }>,
): any {
  return {
    sync_contract_task_result: buildSyncContractFailureResult(
      inputs["era.sync.commit.contract.failure"]
        .value as SyncCommitContractFailureV1,
    ),
  };
}
