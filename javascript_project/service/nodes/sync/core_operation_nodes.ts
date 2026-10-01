import {
  acceptStageCallResult,
  applyExpressionValue,
  evaluateExpression,
  failStageCallTable,
  prepareLibraryValidation,
  prepareStageCall,
  prepareValueExpression,
  recordOperationDiagnostic,
  routeExpressionResult,
} from "../../base_lib/domain/commands/operation_expressions.ts";
import {
  appendOperationLog,
  applyAssignment,
  applyDelete,
  applyInsert,
  completeOperations,
  inheritInsertTemplate,
  inspectDelete,
  inspectEdit,
  inspectInsert,
  pushChildPaths,
  settleOperation,
  skipOperation,
  takeNextOperation,
} from "../../base_lib/domain/commands/operation_traversal.ts";
import {
  applyFunctionCandidate,
  beginFunctionCandidate,
  beginFunctionMetaDelete,
  checkFunctionMetadata,
  discardFunctionCandidate,
  finishFunctionMetaDelete,
  inspectFunctionGroup,
  prepareFunctionDelete,
  prepareFunctionEdit,
  prepareFunctionInsert,
  stageFunctionChange,
} from "../../base_lib/domain/commands/operation_functions.ts";

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/complete_operations.ts。 */
export function CompleteOperationsNode(inputs: any): any {
  const state = completeOperations(inputs["era.command.operation.state"].value);
  return {
    complete_operations_operation_state_after: state,
    complete_operations_operation_done: state.done,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/settle_operation.ts。 */
export function SettleOperationNode(inputs: any): any {
  const state = settleOperation(inputs["era.command.operation.state"].value);
  return {
    settle_operation_operation_state_after: state,
    settle_operation_operation_done: state.done,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/skip_operation.ts。 */
export function SkipOperationNode(inputs: any): any {
  return {
    skip_operation_operation_state: skipOperation(
      inputs["era.command.operation.state"].value,
    ),
  };
}


import type { OperationState } from '../../base_lib/domain/commands/operation_state.ts';
/** 按指令和字段顺序选择下一项业务操作。 */
export function SelectBusinessOperationNode(inputs: any): any {
 const next = takeNextOperation(inputs['era.command.operation.state'].value);
 return {take_next_operation_operation_state:next.state,take_next_operation_operation_route:next.route};
}
function insertAction(input: OperationState): OperationState {
 const next = inspectInsert(input);
 return next.route === 'descend' ? pushChildPaths(next.state) : next.route === 'apply' ? appendOperationLog(applyInsert(inheritInsertTemplate(next.state))) : skipOperation(next.state);
}
function editAction(input: OperationState): OperationState {
 const next = inspectEdit(input);
 if(next.route === 'descend') return pushChildPaths(next.state);
 if(next.route === 'assign') return appendOperationLog(applyAssignment(next.state));
 if(next.route === 'expr') {
 const expression = routeExpressionResult(evaluateExpression(prepareValueExpression(next.state)));
 return expression.route === 'value' ? appendOperationLog(applyExpressionValue(expression.state)) : recordOperationDiagnostic(expression.state);
 }
 return skipOperation(next.state);
}
function deleteAction(input: OperationState): OperationState {
 const next = inspectDelete(input);
 return next.route === 'descend' ? pushChildPaths(next.state) : next.route === 'apply' ? appendOperationLog(applyDelete(next.state)) : skipOperation(next.state);
}
export function ApplyInsertActionNode(inputs: any): any {return {apply_insert_action_operation_state:insertAction(inputs['era.command.operation.state'].value)};}
export function ApplyEditActionNode(inputs: any): any {return {apply_edit_action_operation_state:editAction(inputs['era.command.operation.state'].value)};}
export function ApplyDeleteActionNode(inputs: any): any {return {apply_delete_action_operation_state:deleteAction(inputs['era.command.operation.state'].value)};}
function acceptFunctionItem(input: OperationState): OperationState {
 const checked = checkFunctionMetadata(input);
 return checked.route === 'apply' ? stageFunctionChange(checked.state) : checked.route === 'invalid' ? discardFunctionCandidate(checked.state) : skipOperation(checked.state);
}
/** 在候选副本上完成整组函数修改和校验，然后一次应用。 */
export async function ApplyFunctionGroupActionNode(inputs: any, _params?: any, context?: any): Promise<any> {
 const inspected = inspectFunctionGroup(inputs['era.command.operation.state'].value);
 if(inspected.route === 'invalid') return {apply_function_group_action_operation_state:discardFunctionCandidate(inspected.state)};
 let state = settleOperation(beginFunctionCandidate(inspected.state));
 while(state.functionGroup) {
 await Promise.resolve();
 context?.signal?.throwIfAborted();
 const next = takeNextOperation(state);
 state = next.state;
 switch(next.route) {
 case 'function-insert': state = acceptFunctionItem(prepareFunctionInsert(state)); break;
 case 'function-edit': state = acceptFunctionItem(prepareFunctionEdit(state)); break;
 case 'function-delete': {
 const item = prepareFunctionDelete(state);
 state = item.route === 'meta' ? beginFunctionMetaDelete(item.state) : acceptFunctionItem(item.state); break;
 }
 case 'delete': state = deleteAction(state); break;
 case 'function-meta-complete': state = acceptFunctionItem(finishFunctionMetaDelete(state)); break;
 case 'function-validate': {
 const result = routeExpressionResult(evaluateExpression(prepareLibraryValidation(state)));
 state = result.route === 'library' ? applyFunctionCandidate(result.state) : discardFunctionCandidate(result.state); break;
 }
 default: throw new TypeError('函数组处理中出现未知操作：'+next.route);
 }
 if(state.functionGroup) state = settleOperation(state);
 }
 return {apply_function_group_action_operation_state:state};
}
/** 计算本次阶段函数调用，收集结果或记录失败。 */
export function ApplyStageCallActionNode(inputs: any): any {
 const result = routeExpressionResult(evaluateExpression(prepareStageCall(inputs['era.command.operation.state'].value)));
 return {apply_stage_call_action_operation_state:result.route === 'stage-call' ? acceptStageCallResult(result.state) : failStageCallTable(result.state)};
}
