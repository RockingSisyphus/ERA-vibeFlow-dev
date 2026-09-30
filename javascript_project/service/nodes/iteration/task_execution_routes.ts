import {
  executionPorts,
  type NodeInputs,
  type PreparedTask,
  prepared,
  type ExecutedTask,
} from "../../base_lib/task_continuation.ts";

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/iteration/task_execution_routes.ts。 */
export function routeEntry(inputs: NodeInputs): any {
  const route = inputs["era.task.route"].value;
  const step = inputs["era.step.request.routed"].value;
  const executionState = inputs["era.batch.execution.state"].value;
  const entry =
    route === "initialize"
      ? "initialize"
      : route === "api"
        ? "api"
        : route === "agent-generation-session"
          ? "agent"
          : route === "sync"
            ? "sync"
            : "simple";
  return {
    route_entry_entry_route: entry,
    route_entry_routed_step: step,
    route_entry_batch_state: executionState,
    route_entry_task_route: route,
    route_entry_entry_continuation: {
      origin: entry === "simple" ? "sync" : entry,
      step,
      executionState,
    },
  };
}
export function routeExecutionRequest(inputs: NodeInputs): any {
  const ports = executionPorts(
    inputs["era.task.prepared"].value as PreparedTask,
  );
  return {
    route_execution_request_execution_route: ports.execution_route,
    route_execution_request_execution_request: ports.execution_request,
    route_execution_request_continuation: ports.continuation,
    route_execution_request_execution_step: ports.execution_step,
    route_execution_request_execution_batch: ports.execution_batch,
  };
}
export function routeAgentFollowup(inputs: NodeInputs): any {
  const ports = executionPorts(
    inputs["era.task.prepared"].value as PreparedTask,
  );
  return {
    route_agent_followup_execution_route: ports.execution_route,
    route_agent_followup_execution_request: ports.execution_request,
    route_agent_followup_continuation: ports.continuation,
    route_agent_followup_execution_step: ports.execution_step,
    route_agent_followup_execution_batch: ports.execution_batch,
  };
}
export function routeCompletionOrigin(inputs: NodeInputs): any {
  const executed = inputs["era.task.execution.result"].value;
  return {
    route_completion_origin_completion_origin:
      executed.continuation.origin === "api" ? "api" : "ordinary",
    route_completion_origin_executed_task: executed,
  };
}

/** 本模块中的各导出分别由独立 Node descriptor 调用，执行分支仍由正式 Config 决定。原实现：nodes/iteration/task_continuations.ts。 */
export function preparePlainSync(inputs: NodeInputs): any {
  return {
    prepare_plain_sync_prepared_task: prepared(
      "sync",
      {
        step: inputs["era.step.request.routed"].value,
        executionState: inputs["era.batch.execution.state"].value,
      },
      inputs["era.task.continuation.context"].value,
    ),
  };
}
export function acceptCommitResult(inputs: NodeInputs): any {
  return {
    accept_commit_result_executed_task: {
      kind: "commit",
      value: inputs["era.api.facade.result"].value,
      continuation: inputs["era.task.continuation.context"].value,
    },
  };
}
export function acceptSyncResult(inputs: NodeInputs): any {
  return {
    accept_sync_result_executed_task: {
      kind: "sync",
      value: inputs["era.task.result"].value,
      continuation: inputs["era.task.continuation.context"].value,
    },
  };
}
export function takeDirectResult(inputs: NodeInputs): any {
  return {
    take_direct_result_executed_task: {
      kind: "direct",
      value: inputs["era.task.execution.request"].value.payload,
      continuation: inputs["era.task.continuation.context"].value,
    },
  };
}
export function completePreparedTask(inputs: NodeInputs): any {
  return {
    complete_prepared_task_completed_task: (
      inputs["era.task.execution.result"].value as ExecutedTask
    ).value,
  };
}

/** 分支确定后才产生严格的 API 请求，不为未选中分支填充假值。 */
export function extractCommitRequest(inputs: NodeInputs): any {
  return {
    extract_commit_request_result:
      inputs["era.task.execution.request"].value.payload.request,
  };
}
/** 候选循环只接收准备阶段产生的真实起点。 */
export function extractCandidateState(inputs: NodeInputs): any {
  return {
    extract_candidate_state_result:
      inputs["era.task.execution.request"].value.payload,
  };
}

/** 在准备分支中显式转交原任务，防止它在中间结果替换时丢失。 */
export function carryPreparationContext(inputs: NodeInputs): any {
  return {
    carry_preparation_context_result:
      inputs["era.task.continuation.context"].value,
  };
}
/** 候选起点还需要原步骤和批次；它们与接续上下文来自同一在途任务。 */
export function carryCandidateInputs(inputs: NodeInputs): any {
  const continuation = inputs["era.task.continuation.context"].value;
  return {
    carry_candidate_inputs_context: continuation,
    carry_candidate_inputs_step: continuation.step,
    carry_candidate_inputs_batch: continuation.executionState,
  };
}
