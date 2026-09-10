import { compileFunctionLibrary } from '@era/vibeflow-expression/engine';
import { planFunctionLibraryDiff } from '../../base_lib/domain/workbench_draft.js';
import { defineOwn, isRecord } from '../../base_lib/domain/workbench_operations.js';
import { workbenchError, type Draft, type OperationPlan } from '../../base_lib/domain/workbench_context.ts';
/** 单项修改只替换当前库中的目标，整库替换已在基准节点核对完整原库。 */
export function run(inputs: any): any {
  const draft = inputs['era.workbench.draft'].value as Draft;
  const operation_plan: OperationPlan = { draft, operations: [], changes: [], error: null };
  try {
    const { request } = draft;
    const original = draft.baseline.record!.state.statFunc;
    const library = request.mode === 'batch' ? request.value : structuredClone(original);
    if (!isRecord(library)) throw new Error('函数库必须是对象。');
    if (request.mode !== 'batch') {
      if (request.mode === 'delete') delete library[request.name!];
      else defineOwn(library, request.name!, request.value);
    }
    const diagnostics = compileFunctionLibrary(library).diagnostics;
    if (diagnostics.length) throw new Error(diagnostics.map(item => item.message).join('；'));
    const plan = planFunctionLibraryDiff(original, library);
    operation_plan.operations = plan.operations;
    operation_plan.changes = plan.changes.map(change => ({ ...change, domain: 'function' }));
  } catch (reason) { operation_plan.error = workbenchError(reason); }
  return { function_operation_plan: operation_plan };
}
