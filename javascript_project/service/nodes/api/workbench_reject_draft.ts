import { rejected, type Draft } from '../../base_lib/domain/workbench_context.ts';
/** 失败只返回原 Commit 的错误上下文，不产生操作或写入。 */
export function run(inputs: any): any {
  const draft = inputs['era.workbench.draft'].value as Draft;
  return { rejected_preparation_result: rejected(draft.inspected, draft.error!) };
}
