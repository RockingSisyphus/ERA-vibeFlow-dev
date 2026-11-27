import {createProgress,advanceSync} from "../../../../base_lib/workflow_progress/progress.ts";
export function begin(factory:any,inputs:any,params:any,signal:any):any {return advanceSync(createProgress(factory,inputs,params),undefined,undefined,signal);}
export function request(state:any,address:any):any {return {payload:{...state.request,ownerToken:address.ownerToken},retained_state:state};}
export function inspect(state:any,outputs:any):any {
 if(outputs.workflowFailure!==undefined) state.reply={failure:domainFailure(outputs.workflowFailure)};
 else {const reply=outputs.result;if(reply.pending)state.waitToken=reply.pending;else state.reply={value:reply.value};}
 return {prepared:state,wait_route:state.waitToken?'wait':'immediate'};
}
export function prepareWait(state:any,address:any):any {return {payload_async:{ownerToken:address.ownerToken,operationToken:state.waitToken}};}
function failure(error:any):any {if(error instanceof Error)return error;const next:any=new Error(error?.message??String(error),error?.cause?{cause:failure(error.cause)}:undefined);Object.assign(next,error);if(error?.cause)next.cause=failure(error.cause);return next;}
/** 恢复被官方调用层包裹的领域错误；完整包装链仍作为cause保留，清理错误不被丢弃。 */
function domainFailure(value:any):any {
 const wrapped=failure(value);let reason=wrapped;
 while(['VF_CAPABILITY_FAILED','VF_NODE_FAILED'].includes(reason?.code)&&reason.cause&&!reason.cleanup_errors?.length&&!reason.cleanupErrors?.length)reason=reason.cause;
 if(reason===wrapped)return wrapped;
 const error:any=new Error(reason.message,{cause:wrapped});
 Object.assign(error,reason,{cause:wrapped});error.name=reason.name??'Error';
 return error;
}
export function terminal(state:any,ended:any):any {state.waitToken=undefined;state.reply=ended.state==='succeeded'?{value:ended.outputs.result}:{failure:domainFailure(ended.error??{message:'酒馆操作未成功结束。'})};return {terminal_completed:state};}
export function advance(state:any,signal:any):any {const reply=state.reply;state.reply=undefined;advanceSync(state,reply?.value,reply?.failure,signal);return {next_state:state,done:state.done};}
