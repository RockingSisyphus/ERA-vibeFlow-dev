import { normalizeOrderedOperations } from '../../base_lib/domain/workbench_operations.js';
import { workbenchError, type Draft, type OperationPlan } from '../../base_lib/domain/workbench_context.ts';
/** 显式操作不重排、不解锁；后续继续走原 Commit 事务校验。 */
export function run(inputs: any): any {
  const draft = inputs['era.workbench.draft'].value as Draft;
  const operation_plan: OperationPlan = { draft, operations: [], changes: [], error: null };
  try { operation_plan.operations = normalizeOrderedOperations(draft.request.operations); }
  catch (reason) { operation_plan.error = workbenchError(reason); }
  return { ordered_operation_plan: operation_plan };
}
