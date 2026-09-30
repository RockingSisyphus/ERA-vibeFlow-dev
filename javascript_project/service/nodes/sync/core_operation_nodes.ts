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

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/accept_stage_call_result.ts。 */
export function AcceptStageCallResultNode(inputs: any): any {
  return {
    accept_stage_call_result_operation_state: acceptStageCallResult(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/append_operation_log.ts。 */
export function AppendOperationLogNode(inputs: any): any {
  return {
    append_operation_log_operation_state: appendOperationLog(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/apply_assignment.ts。 */
export function ApplyAssignmentNode(inputs: any): any {
  return {
    apply_assignment_operation_state: applyAssignment(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/apply_delete.ts。 */
export function ApplyDeleteNode(inputs: any): any {
  return {
    apply_delete_operation_state: applyDelete(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/apply_expression_value.ts。 */
export function ApplyExpressionValueNode(inputs: any): any {
  return {
    apply_expression_value_operation_state: applyExpressionValue(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/apply_function_candidate.ts。 */
export function ApplyFunctionCandidateNode(inputs: any): any {
  return {
    apply_function_candidate_operation_state: applyFunctionCandidate(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/apply_insert.ts。 */
export function ApplyInsertNode(inputs: any): any {
  return {
    apply_insert_operation_state: applyInsert(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/begin_function_candidate.ts。 */
export function BeginFunctionCandidateNode(inputs: any): any {
  return {
    begin_function_candidate_operation_state: beginFunctionCandidate(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/begin_function_meta_delete.ts。 */
export function BeginFunctionMetaDeleteNode(inputs: any): any {
  return {
    begin_function_meta_delete_operation_state: beginFunctionMetaDelete(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/check_function_metadata.ts。 */
export function CheckFunctionMetadataNode(inputs: any): any {
  const result = checkFunctionMetadata(
    inputs["era.command.operation.state"].value,
  );
  return {
    check_function_metadata_operation_state: result.state,
    check_function_metadata_function_item_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/complete_operations.ts。 */
export function CompleteOperationsNode(inputs: any): any {
  const state = completeOperations(inputs["era.command.operation.state"].value);
  return {
    complete_operations_operation_state_after: state,
    complete_operations_operation_done: state.done,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/discard_function_candidate.ts。 */
export function DiscardFunctionCandidateNode(inputs: any): any {
  return {
    discard_function_candidate_operation_state: discardFunctionCandidate(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/evaluate_expression.ts。 */
export function EvaluateExpressionNode(inputs: any): any {
  return {
    evaluate_expression_expression_response: evaluateExpression(
      inputs["era.command.expression.request"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/fail_stage_call_table.ts。 */
export function FailStageCallTableNode(inputs: any): any {
  return {
    fail_stage_call_table_operation_state: failStageCallTable(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/finish_function_meta_delete.ts。 */
export function FinishFunctionMetaDeleteNode(inputs: any): any {
  return {
    finish_function_meta_delete_operation_state: finishFunctionMetaDelete(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/inherit_insert_template.ts。 */
export function InheritInsertTemplateNode(inputs: any): any {
  return {
    inherit_insert_template_operation_state: inheritInsertTemplate(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/inspect_delete.ts。 */
export function InspectDeleteNode(inputs: any): any {
  const result = inspectDelete(inputs["era.command.operation.state"].value);
  return {
    inspect_delete_operation_state: result.state,
    inspect_delete_delete_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/inspect_edit.ts。 */
export function InspectEditNode(inputs: any): any {
  const result = inspectEdit(inputs["era.command.operation.state"].value);
  return {
    inspect_edit_operation_state: result.state,
    inspect_edit_edit_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/inspect_function_group.ts。 */
export function InspectFunctionGroupNode(inputs: any): any {
  const result = inspectFunctionGroup(
    inputs["era.command.operation.state"].value,
  );
  return {
    inspect_function_group_operation_state: result.state,
    inspect_function_group_function_group_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/inspect_insert.ts。 */
export function InspectInsertNode(inputs: any): any {
  const result = inspectInsert(inputs["era.command.operation.state"].value);
  return {
    inspect_insert_operation_state: result.state,
    inspect_insert_insert_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/prepare_function_delete.ts。 */
export function PrepareFunctionDeleteNode(inputs: any): any {
  const result = prepareFunctionDelete(
    inputs["era.command.operation.state"].value,
  );
  return {
    prepare_function_delete_operation_state: result.state,
    prepare_function_delete_function_delete_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/prepare_function_edit.ts。 */
export function PrepareFunctionEditNode(inputs: any): any {
  return {
    prepare_function_edit_operation_state: prepareFunctionEdit(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/prepare_function_insert.ts。 */
export function PrepareFunctionInsertNode(inputs: any): any {
  return {
    prepare_function_insert_operation_state: prepareFunctionInsert(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/prepare_library_validation.ts。 */
export function PrepareLibraryValidationNode(inputs: any): any {
  return {
    prepare_library_validation_expression_request: prepareLibraryValidation(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/prepare_stage_call.ts。 */
export function PrepareStageCallNode(inputs: any): any {
  return {
    prepare_stage_call_expression_request: prepareStageCall(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/prepare_value_expression.ts。 */
export function PrepareValueExpressionNode(inputs: any): any {
  return {
    prepare_value_expression_expression_request: prepareValueExpression(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/push_child_paths.ts。 */
export function PushChildPathsNode(inputs: any): any {
  return {
    push_child_paths_operation_state: pushChildPaths(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/record_operation_diagnostic.ts。 */
export function RecordOperationDiagnosticNode(inputs: any): any {
  return {
    record_operation_diagnostic_operation_state: recordOperationDiagnostic(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/route_expression_result.ts。 */
export function RouteExpressionResultNode(inputs: any): any {
  const result = routeExpressionResult(
    inputs["era.command.expression.response"].value,
  );
  return {
    route_expression_result_operation_state: result.state,
    route_expression_result_expression_route: result.route,
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

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/stage_function_change.ts。 */
export function StageFunctionChangeNode(inputs: any): any {
  return {
    stage_function_change_operation_state: stageFunctionChange(
      inputs["era.command.operation.state"].value,
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/commands/take_next_operation.ts。 */
export function TakeNextOperationNode(inputs: any): any {
  const result = takeNextOperation(inputs["era.command.operation.state"].value);
  return {
    take_next_operation_operation_state: result.state,
    take_next_operation_operation_route: result.route,
  };
}
