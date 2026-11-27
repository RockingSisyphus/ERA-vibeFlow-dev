import { planSyncWork } from "../../base_lib/sync/sync_work_preparation.ts";
import {
  dispatchContext,
  type SyncContextV1,
} from "../../base_lib/sync/sync_contracts.ts";
import type { EraBlockStepStateV1 } from "../../base_lib/sync/sync_contracts.ts";
/** 只准备历史回退及待处理区间，不提前应用任何消息操作。 */
export function prepare(inputs: any): any {
  const context = inputs["era.sync.context"].value as SyncContextV1;
  const task=(context.step as any).task;
  // 结束事件可能与收到消息等历史变化合并。只有纯结束通知才可省略历史处理，
  // 不能按最后一个事件丢掉同项任务里尚未处理的接收、编辑或回退来源。
  const endedOnly = task?.primaryEvent.type === 'generation_ended' &&
    task.sourceEvents.every((event: {type: string}) => event.type === 'generation_ended');
  const work = endedOnly && context.nativeCandidatePending!==true
    ? {schemaVersion:1 as const,step:context.step,disposition:'no-op' as const,plan:null,payload:null,failure:null}
    : planSyncWork(context);
  const prepared = dispatchContext(work.step);
  const state: EraBlockStepStateV1 = {
    work,
    done: work.disposition !== "commit",
    sourceBasis:
      prepared.schemaVersion === 3 ? (prepared.sourceBasis ?? null) : null,
    ...(context.scopeWindow ? { scopeWindow: context.scopeWindow } : {}),
  };
  return { block_step_state: state };
}
