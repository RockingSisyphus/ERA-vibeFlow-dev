import { jsonEqual } from '../../base_lib/workbench/workbench_operations.js';
import { variablePlanProtections, functionPlanProtections, wrapVariableProtection, wrapFunctionPlanProtections } from '../../base_lib/workbench/workbench_protection.js';
import { rejected, workbenchError, type OperationPlan } from '../../base_lib/workbench/workbench_context.ts';
/** 比较用户看到的保护与提交时的实际保护，避免隐式扩大解锁范围。 */
export function run(inputs: any): any {
  const plan = inputs['era.workbench.operation_plan'].value as OperationPlan;
  const { draft } = plan;
  if (plan.error) return { protected_preparation_result: rejected(draft.inspected, plan.error) };
  try {
    const { request } = draft;
    const state = draft.baseline.record!.state;
    const variable = request.domain === 'variable';
    const protections = variable ? variablePlanProtections(state.statData, { operations: plan.operations, changedPaths: [], changes: plan.changes.map(change => ({ kind: change.kind, path: change.path! })) }) : request.domain === 'function' ? functionPlanProtections(state.statFunc, { operations: plan.operations, changedNames: [], changes: plan.changes.map(change => ({ kind: change.kind, name: change.name! })) }) : [];
    if (!jsonEqual(protections, request.protections)) throw new Error('保护条件在预览后已经变化，请重新查看并确认。');
    let operations = plan.operations;
    if (!operations.length) throw new Error('没有检测到需要保存的变化。');
    if (protections.length) {
      if (!request.choice) throw new Error('请选择如何处理 ERA 保护。');
      operations = variable ? wrapVariableProtection(operations, protections, request.choice, state.statData) : wrapFunctionPlanProtections(operations, protections as ReturnType<typeof functionPlanProtections>, request.choice);
    }
    const inspected = { ...draft.inspected, request: { ...draft.inspected.request, detail: { ...draft.inspected.request.detail, scope: 'always', operations } } };
    return { protected_preparation_result: { route: 'ready', inspected, failure: {} } };
  } catch (reason) { return { protected_preparation_result: rejected(draft.inspected, workbenchError(reason)) }; }
}
