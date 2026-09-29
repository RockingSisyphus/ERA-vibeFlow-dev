// Adapters with identical declared base libraries share this source.
import { type Inspected, rejected, type Draft } from "../../base_lib/domain/workbench_context.ts";

// Original node: nodes/api/workbench_publish_preparation.ts
/** 真实 Nodeset 出口接回已有 Commit 准入或失败分支。 */
export function WorkbenchPublishPreparationNode(inputs: any): any {
  const result = inputs['era.workbench.preparation_result'].value as { route: 'ready' | 'failed'; inspected: Inspected; failure: object };
  return { prepared_commit_inspected: result.inspected, preparation_route: result.route, preparation_failure: result.failure };
}

// Original node: nodes/api/workbench_reject_draft.ts
/** 失败只返回原 Commit 的错误上下文，不产生操作或写入。 */
export function WorkbenchRejectDraftNode(inputs: any): any {
  const draft = inputs['era.workbench.draft'].value as Draft;
  return { rejected_preparation_result: rejected(draft.inspected, draft.error!) };
}

// Original node: nodes/api/workbench_route_request_kind.ts
/** 原公共 commit 直接通过；只有内部工作台命令进入草稿准备。 */
export function WorkbenchRouteRequestKindNode(inputs: any): any {
  const inspected = inputs['era.api.commit.inspected'].value as Inspected;
  return { commit_inspected: inspected, workbench_request_kind: inspected.request.detail.command === 'workbench-commit' ? 'draft' : 'operations' };
}
