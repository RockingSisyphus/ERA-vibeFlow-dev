import { executeExpressionLayer } from '@era/vibeflow-expression/engine';
import { planVariableDelete, planVariableDiff, planVariableExpression, planVariableInsert } from '../../base_lib/domain/workbench_draft.js';
import { workbenchError, type Draft, type OperationPlan } from '../../base_lib/domain/workbench_context.ts';
/** 草稿在权威基准上重新解释；表达式使用现有引擎做完整诊断。 */
export function run(inputs: any): any {
  const draft = inputs['era.workbench.draft'].value as Draft;
  const operation_plan: OperationPlan = { draft, operations: [], changes: [], error: null };
  try {
    const request = draft.request;
    const path = request.path ?? [];
    const state = draft.baseline.record!.state;
    if (request.expression !== undefined) {
      if (request.mode !== 'edit' || typeof request.expression !== 'string' || path.some(key => !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key))) throw new Error('表达式目标必须是有效数值路径。');
      const result = executeExpressionLayer({ initialState: state.statData, snapshotState: state.statData, functionLibrary: state.statFunc, snapshotFunctionLibrary: state.statFunc, allowSnapshots: true, operations: [{ path: path.join('.'), expr: request.expression }] });
      if (result.status !== 'ok') throw new Error(result.diagnostics.map(item => item.message).join('；'));
    }
    const plan = request.mode === 'delete' ? planVariableDelete(path) : request.expression !== undefined ? planVariableExpression(path, request.expression) : request.mode === 'add' ? planVariableInsert(path, request.value) : planVariableDiff(request.initial, request.value, path);
    operation_plan.operations = plan.operations;
    operation_plan.changes = plan.changes.map(change => ({ ...change, domain: 'variable' }));
  } catch (reason) { operation_plan.error = workbenchError(reason); }
  return { variable_operation_plan: operation_plan };
}
