// Adapters with identical declared base libraries share this source.
import { type Inspected, rejected, type Draft } from "../../base_lib/workbench/workbench_context.ts";

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
