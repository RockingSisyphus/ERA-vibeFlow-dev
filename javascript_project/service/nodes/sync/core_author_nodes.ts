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

/** 一次作者函数处理结束后才返回外层位置，不把中间状态当成多个最终结果。 */
export function CompleteAuthorStepNode(inputs: any): any {
  return {
    complete_author_step_position_state: inputs["era.sync.author.state"].value,
  };
}


function finishEffect(result: any, context: any): any {
 return result.route === 'failed' ? recordHostFailure(result.state,context.capabilities['era.tavern.functions']) : result.state;
}
/** 读取正文调用，启动作者函数或记录解析结果。 */
export function BeginAuthorCallNode(inputs: any, _params: any, context: any): any {
 const inspected = inspectAuthorCall(inputs['era.sync.author.state'].value);
 const effect = functionEffect(inspected.state,state => inspected.route === 'valid' ? beginAuthorFunction(state,context.capabilities['era.tavern.functions']) : finishAuthorFunction(state,context.capabilities['era.tavern.functions']));
 return {begin_author_call_author_state:finishEffect(effect,context)};
}
/** 确认已经应用的提交，等待作者函数下一步事件。 */
export async function ReceiveAuthorEventNode(inputs: any, _params: any, context: any): Promise<any> {
 const ack = functionEffect(inputs['era.sync.author.state'].value,state => acknowledgeCompletedCommit(state,context.capabilities['era.tavern.functions']));
 if(ack.route === 'failed') return {receive_author_event_author_state:finishEffect(ack,context),author_event:'complete',author_finish:false};
 const event = routeFunctionEvent(await waitFunctionEvent(ack.state,context));
 return {receive_author_event_author_state:event.state,author_event:event.route,author_finish:event.route === 'done' || event.route === 'failed'};
}
/** 将作者提交接入当前正文；立即完成的请求就地回告。 */
export function PrepareAuthorCommitNode(inputs: any, _params: any, context: any): any {
 const commit = prepareFunctionCommit(inputs['era.sync.author.state'].value);
 const state = commit.route === 'failed' ? recordHostFailure(commit.state,context.capabilities['era.tavern.functions'])
 : commit.route === 'immediate' ? finishEffect(functionEffect(commit.state,state => acknowledgeImmediateRequest(state,context.capabilities['era.tavern.functions'])),context) : commit.state;
 return {prepare_author_commit_author_state:state};
}
/** 回告运行中作者函数的历史同步请求。 */
export function AnswerAuthorSyncNode(inputs: any, _params: any, context: any): any {
 return {answer_author_sync_author_state:finishEffect(functionEffect(inputs['era.sync.author.state'].value,state => rejectFunctionSync(state,context.capabilities['era.tavern.functions'])),context)};
}
/** 作者调用结束后，整理正文标记并释放运行资料。 */
export function FinishAuthorCallNode(inputs: any, _params: any, context: any): any {
 const state = inputs['era.sync.author.state'].value;
 const functions = context.capabilities['era.tavern.functions'];
 return {finish_author_call_author_state: inputs['era.sync.author.lifecycle.route']?.value === 'terminal' ? releaseTerminalFunction(state,functions)
 : inputs['era.sync.author.event.action']?.value === 'failed' ? recordHostFailure(state,functions)
 : finishEffect(functionEffect(state,next => finishAuthorFunction(next,functions)),context)};
}
