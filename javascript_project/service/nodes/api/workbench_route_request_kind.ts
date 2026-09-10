import type { Inspected } from '../../base_lib/domain/workbench_context.ts';
/** 原公共 commit 直接通过；只有内部工作台命令进入草稿准备。 */
export function run(inputs: any): any {
  const inspected = inputs['era.api.commit.inspected'].value as Inspected;
  return { commit_inspected: inspected, workbench_request_kind: inspected.request.detail.command === 'workbench-commit' ? 'draft' : 'operations' };
}
