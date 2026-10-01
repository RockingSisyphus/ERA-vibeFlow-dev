import {
  executionPorts,
  type NodeInputs,
  type PreparedTask,
  prepared,
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


import { adaptSyncResult } from '../../base_lib/facade_api_engine.ts';
/** 为标识、设置和忽略任务准备原任务及批次资料。 */
export function prepareSimpleTask(inputs: NodeInputs): any {
 const step = inputs['era.step.request.routed'].value;
 const executionState = inputs['era.batch.execution.state'].value;
 return { simple_prepared_task: prepared('simple', {step, executionState, route: inputs['era.task.route'].value}, {origin:'sync', step, executionState}) };
}
function actionPorts(task: PreparedTask): any {
 const ports = executionPorts(task);
 return {
 action_continuation: task.continuation,
 action_batch: ports.execution_batch, action_step: ports.execution_step,
 action_direct: task.request.kind === 'direct' ? {kind:'direct', value:task.request.payload, continuation:task.continuation} : null,
 };
}
/** 选择本项任务的执行入口，同时交付该入口需要的请求。 */
export function selectAction(inputs: NodeInputs): any {
 const task = inputs['era.task.prepared'].value as PreparedTask;
 return {...actionPorts(task), action_route:task.request.kind,
 action_commit:task.request.kind === 'commit' ? task.request.payload.request : null,
 action_candidate:task.request.kind === 'candidate' ? task.request.payload : null,
 action_simple:task.request.kind === 'simple' ? task.request.payload.route : null};
}
/** 模型阶段结束后选择历史同步、消息标识或直接返回。 */
export function selectFollowup(inputs: NodeInputs): any {
 const task = inputs['era.task.prepared'].value as PreparedTask;
 const ports = actionPorts(task);
 return {followup_route:task.request.kind,followup_continuation:ports.action_continuation,followup_batch:ports.action_batch,followup_step:ports.action_step,followup_direct:ports.action_direct};
}
/** 用执行入口的实际结果形成原调用方回执。 */
export function finishResult(inputs: any): any {
 const continuation = inputs['era.task.continuation.context'].value;
 const commit = inputs['era.api.facade.result']?.value;
 const task = inputs['era.task.result']?.value;
 const direct = inputs['era.task.execution.result.selected']?.value;
 const value = commit ?? (task !== undefined ? (continuation.origin === 'api' ? adaptSyncResult(task, continuation.apiContext) : task) : direct.value);
 return {finished_task_result:value};
}
