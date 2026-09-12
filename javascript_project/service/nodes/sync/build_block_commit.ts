import {
  buildSyncCommitRequest,
  validateSyncCommitEnvelope,
} from "../../base_lib/sync_commit_policy.ts";
import type { SyncWorkV1 } from "../../base_lib/sync_contracts.ts";
import type { EraBlockStepStateV1 } from "../../base_lib/block_step_state.ts";
/** 压缩后的真实候选进入唯一提交链；来源只吸收本任务已确认的写入。 */
export function run(inputs: any): any {
  const work = inputs["era.command_compaction.result"].value as SyncWorkV1;
  const carried = work.blockStepState as unknown as EraBlockStepStateV1;
  const { blockStepState: _carried, ...cleanWork } = work;
  const state: EraBlockStepStateV1 = { ...carried, work: cleanWork };
  if (work.disposition !== "commit")
    return {
      block_commit_request: {
        mode: "non-commit",
        work: { ...cleanWork, blockStepState: state },
      },
    };
  const request = buildSyncCommitRequest(cleanWork);
  const execution =
    work.plan?.status !== "failed" ? work.plan?.execution : null;
  const floor = execution?.floorStarted
    ? work.plan?.messages[execution.messageIndex]
    : null;
  const envelope = {
    mode: "commit",
    request: {
      ...request,
      sourceBasis: state.sourceBasis ?? request.sourceBasis,
      syncCursor:
        floor && execution
          ? {
              messageId: floor.messageId,
              mk: String(
                (work.plan?.meta.SelectedMks as unknown[])?.[
                  execution.messageIndex
                ] ?? "",
              ),
              blockIndex: Math.max(0, execution.blockIndex - 1),
            }
          : null,
      initialPresentation: state.done ? request.initialPresentation : null,
      blockStepState: state,
    },
  };
  const checked = validateSyncCommitEnvelope(envelope);
  if (checked.route === "failed") {
    const failedWork = {
      ...cleanWork,
      disposition: "failed" as const,
      failure: checked.failure.failure,
      plan: state.lastResult?.plan ?? null,
    };
    return {
      block_commit_request: {
        mode: "non-commit",
        work: {
          ...failedWork,
          blockStepState: { ...state, done: true, work: failedWork },
        },
      },
    };
  }
  return { block_commit_request: envelope };
}
