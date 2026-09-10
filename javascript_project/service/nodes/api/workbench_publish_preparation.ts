import type { Inspected } from '../../base_lib/domain/workbench_context.ts';
/** 真实 Nodeset 出口接回已有 Commit 准入或失败分支。 */
export function run(inputs: any): any {
  const result = inputs['era.workbench.preparation_result'].value as { route: 'ready' | 'failed'; inspected: Inspected; failure: object };
  return { prepared_commit_inspected: result.inspected, preparation_route: result.route, preparation_failure: result.failure };
}
