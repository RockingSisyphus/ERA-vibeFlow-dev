import {
  acknowledgeCompletedCommit,
  functionEffect,
  acknowledgeImmediateRequest,
  beginAuthorFunction,
  finishAuthorFunction,
  inspectAuthorCall,
  prepareFunctionCommit,
  recordHostFailure,
  rejectFunctionSync,
  releaseTerminalFunction,
  routeAuthorLifecycle,
  routeFunctionEvent,
  waitFunctionEvent,
} from "../../base_lib/sync/position_author.ts";

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/acknowledge_completed_commit.ts。 */
export function AcknowledgeCompletedCommitNode(
  inputs: any,
  _params: any,
  context: any,
): any {
  const result = functionEffect(
    inputs["era.sync.author.state"].value,
    (state) =>
      acknowledgeCompletedCommit(
        state,
        context.capabilities["era.tavern.functions"],
      ),
  );
  return {
    acknowledge_completed_commit_position_state: result.state,
    acknowledge_completed_commit_function_effect_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/acknowledge_immediate_request.ts。 */
export function AcknowledgeImmediateRequestNode(
  inputs: any,
  _params: any,
  context: any,
): any {
  const result = functionEffect(
    inputs["era.sync.author.state"].value,
    (state) =>
      acknowledgeImmediateRequest(
        state,
        context.capabilities["era.tavern.functions"],
      ),
  );
  return {
    acknowledge_immediate_request_position_state: result.state,
    acknowledge_immediate_request_function_effect_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/begin_author_function.ts。 */
export function BeginAuthorFunctionNode(
  inputs: any,
  _params: any,
  context: any,
): any {
  const result = functionEffect(
    inputs["era.sync.author.state"].value,
    (state) =>
      beginAuthorFunction(state, context.capabilities["era.tavern.functions"]),
  );
  return {
    begin_author_function_position_state: result.state,
    begin_author_function_function_effect_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/finish_author_function.ts。 */
export function FinishAuthorFunctionNode(
  inputs: any,
  _params: any,
  context: any,
): any {
  const result = functionEffect(
    inputs["era.sync.author.state"].value,
    (state) =>
      finishAuthorFunction(state, context.capabilities["era.tavern.functions"]),
  );
  return {
    finish_author_function_position_state: result.state,
    finish_author_function_function_effect_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/inspect_author_call.ts。 */
export function InspectAuthorCallNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  const result = inspectAuthorCall(inputs["era.sync.author.state"].value);
  return {
    inspect_author_call_position_state: result.state,
    inspect_author_call_author_call_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/prepare_function_commit.ts。 */
export function PrepareFunctionCommitNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  const result = prepareFunctionCommit(inputs["era.sync.author.state"].value);
  return {
    prepare_function_commit_position_state: result.state,
    prepare_function_commit_function_commit_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/record_host_failure.ts。 */
export function RecordHostFailureNode(
  inputs: any,
  _params: any,
  context: any,
): any {
  return {
    record_host_failure_position_state: recordHostFailure(
      inputs["era.sync.author.state"].value,
      context.capabilities["era.tavern.functions"],
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/reject_function_sync.ts。 */
export function RejectFunctionSyncNode(
  inputs: any,
  _params: any,
  context: any,
): any {
  const result = functionEffect(
    inputs["era.sync.author.state"].value,
    (state) =>
      rejectFunctionSync(state, context.capabilities["era.tavern.functions"]),
  );
  return {
    reject_function_sync_position_state: result.state,
    reject_function_sync_function_effect_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/release_terminal_function.ts。 */
export function ReleaseTerminalFunctionNode(
  inputs: any,
  _params: any,
  context: any,
): any {
  return {
    release_terminal_function_position_state: releaseTerminalFunction(
      inputs["era.sync.author.state"].value,
      context.capabilities["era.tavern.functions"],
    ),
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/route_author_lifecycle.ts。 */
export function RouteAuthorLifecycleNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  const result = routeAuthorLifecycle(inputs["era.sync.position.state"].value);
  return {
    route_author_lifecycle_position_state: result.state,
    route_author_lifecycle_author_lifecycle_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/route_function_event.ts。 */
export function RouteFunctionEventNode(
  inputs: any,
  _params: any,
  _context: any,
): any {
  const result = routeFunctionEvent(inputs["era.sync.author.state"].value);
  return {
    route_function_event_position_state: result.state,
    route_function_event_function_event_route: result.route,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/sync/wait_function_event.ts。 */
export async function WaitFunctionEventNode(
  inputs: any,
  _params: any,
  context: any,
): Promise<any> {
  return {
    wait_function_event_position_state: await waitFunctionEvent(
      inputs["era.sync.author.state"].value,
      context,
    ),
  };
}

/** 一次作者函数处理结束后才返回外层位置，不把中间状态当成多个最终结果。 */
export function CompleteAuthorStepNode(inputs: any): any {
  return {
    complete_author_step_position_state: inputs["era.sync.author.state"].value,
  };
}
