/**
 * 逐块提交第一步：把该块之后的累计状态构造成待提交请求。
 *
 * 状态嵌在请求里（同一节点集里同一类型只能有一个产出者），提交结果 `{...request, status, …}` 会
 * 把它带回折回节点；`sourceBasis` 必须按**当前文本**重建，否则同一批次里第 2 次及以后的块提交
 * 会报 `ERA_SYNC_SOURCE_CHANGED`（真机实测）。交接迭代产出不提交信封，不写任何宿主状态。
 */
import {
  buildPerBlockCommitWork,
  type EraBlockStepStateV1,
} from "../../base_lib/block_step_state.ts";
import { buildSyncCommitRequest } from "../../base_lib/sync_commit_policy.ts";
import type { SyncWorkV1 } from "../../base_lib/sync_contracts.ts";

interface Envelope<T> {
  readonly value: T;
}

export function run(
  inputs: Readonly<{ "era.sync.block.step.pending": Envelope<unknown> }>,
): any {
  const state = inputs["era.sync.block.step.pending"].value as EraBlockStepStateV1;
  const work = state.work as unknown as SyncWorkV1;
  const perBlock = buildPerBlockCommitWork({ work, state });
  if (perBlock === null) {
    return {
      block_commit_request: {
        mode: "non-commit" as const,
        work: { ...work, blockStepState: state },
      },
    };
  }
  const request = buildSyncCommitRequest(perBlock);
  const basis = request.sourceBasis;
  return {
    block_commit_request: {
      mode: "commit" as const,
      request: {
        ...request,
        sourceBasis: {
          ...basis,
          messages: basis.messages.map(message =>
            message.messageId === state.messageId
              ? { ...message, activeText: state.content }
              : message,
          ),
        },
        blockStepState: state as unknown as Readonly<Record<string, unknown>>,
      },
    },
  };
}
