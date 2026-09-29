import type { EraBlockStepStateV1 } from "../../base_lib/sync/sync_contracts.ts";
import {
  buildSyncCommitRequest,
  validateSyncCommitEnvelope,
} from "../../base_lib/sync/sync_commit_policy.ts";

/** Freeze accumulated message changes once, including a successful prefix on failure. */
export function finalize(inputs: any): any {
  const state = inputs["era.sync.block.step.state.next"]
    .value as EraBlockStepStateV1;
  const work = state.work;
  const prefix =
    work.disposition === "failed" &&
    work.plan?.status !== "failed" &&
    (work.plan?.messageUpdates.length ?? 0) > 0;
  if (work.disposition !== "commit" && !prefix) {
    return { batch_save_request: { mode: "non-commit", work } };
  }
  const request = buildSyncCommitRequest({ ...work, disposition: "commit" });
  const envelope = {
    mode: "commit",
    request: {
      ...request,
      sourceBasis: state.sourceBasis ?? request.sourceBasis,
      syncCursor: null,
      initialPresentation: prefix ? null : request.initialPresentation,
      blockStepState: state,
    },
  };
  const checked = validateSyncCommitEnvelope(envelope);
  if (checked.route === "failed") {
    return {
      batch_save_request: {
        mode: "non-commit",
        work: {
          ...work,
          disposition: "failed",
          plan: null,
          failure: checked.failure.failure,
        },
      },
    };
  }
  return { batch_save_request: envelope };
}
