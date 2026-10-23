import {takeFrame, emit, route} from "../../base_lib/frames.ts";
import {deferred, linkedSignals, listenAbort, completionResource, observeCompletion} from "../../base_lib/resources.ts";
import {assertCurrentMessageBasis} from "../../base_lib/messages/target.ts";

function requireCall(f:any):any {
  const call=f.session.functionCalls.get(String(f.input.id));
  if(!call?.active)throw new Error("ERA_FUNCTION_CONTEXT_EXPIRED");
  return call;
}
function assertCall(f:any,call:any):void {
  if(!call?.active||call.signal.aborted)throw new Error("ERA_FUNCTION_CONTEXT_EXPIRED");
  assertCurrentMessageBasis(f.session.api,call.sourceBasis);
}
export function CheckBegin(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.callId=String(f.input.id);
  if(f.session.functionCalls.has(f.callId))throw new Error("ERA_FUNCTION_CONTEXT_EXISTS");
  f.options?.signal?.throwIfAborted();assertCurrentMessageBasis(f.session.api,f.input.sourceBasis);
  return emit({frame:f},params);
}
export function BindContext(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;
  // begin只发起受资源Node拥有的调用；发起Node正常返回不能释放后续Node还要使用的上下文。
  // Service接收的信号只覆盖begin节点；内部直接调用可显式绑定额外取消来源。
  const linked=linkedSignals([s.lifecycle.signal,s.operational.signal,f.origin==="service"?undefined:f.options?.signal]);
  const call:any={id:f.callId,active:true,finished:false,error:null,requests:[],pending:new Map(),nextId:1,wake:null,
    parameters:structuredClone(f.input.args??{}),sourceBasis:f.input.sourceBasis,signal:linked.signal,linked,
    name:f.input.name,facade:null,removeAbort:null};
  s.functionContexts??=new WeakMap();f.call=call;
  call.releaseResources=s.resources.keep(()=>{call.removeAbort?.();linked.cleanup();});
  try {
    call.facade=s.createFunctionFacade(
      (type:any,payload:any)=>s.dispatch.functionSubmit({session:s,action:"function_submit",input:{id:call.id,mode:"submit",type,payload}}),
      ()=>s.dispatch.functionContext({session:s,action:"function_submit",input:{id:call.id,mode:"context"}}));
    s.functionContexts.set(call.parameters,call);s.functionCalls.set(call.id,call);
    call.removeAbort=listenAbort(call.signal,()=>s.dispatch.functionRelease({session:s,action:"function_release",input:{id:call.id}}));
  } catch(error){call.releaseResources();throw error;}
  return emit({frame:f},params);
}
export function ScheduleTool(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;s.authorCalls.push({...f});s.authorWake?.resolve();
  return emit({frame:f},params);
}
export function ReturnBegin(inputs:any,params:any):any {const f=takeFrame(inputs);f.result={status:"started",id:f.callId};return emit({frame:f},params);}
export function CheckSubmit(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  if(Object.hasOwn(f.input,"parameters")){
    f.call=f.session.functionContexts?.get(f.input.parameters);
    if(!f.call)throw new Error("ERA_FUNCTION_CONTEXT_EXPIRED");
  } else {f.call=requireCall(f);assertCall(f,f.call);}
  return emit(route(f,f.input.mode==="context"?"context":"submit"),params);
}
export function AllocateRequest(inputs:any,params:any):any {
  const f=takeFrame(inputs),d=deferred();f.localRequest={...d,id:f.call.nextId++,type:f.input.type,payload:structuredClone(f.input.payload)};
  return emit({frame:f},params);
}
export function EnqueueRequest(inputs:any,params:any):any {
  const f=takeFrame(inputs),c=f.call,r=f.localRequest;c.requests.push(r);c.pending.set(r.id,r);c.wake?.resolve();return emit({frame:f},params);
}
export function ReturnSubmit(inputs:any,params:any):any {const f=takeFrame(inputs);f.result=f.input.mode==="context"?f.call.facade:f.localRequest.promise;return emit({frame:f},params);}
export function CheckNext(inputs:any,params:any):any {const f=takeFrame(inputs);f.call=requireCall(f);assertCall(f,f.call);return emit({frame:f},params);}
export function StartNext(inputs:any,params:any):any {
  const f=takeFrame(inputs), captured={...f}, resource=completionResource(f);
  observeCompletion(resource,async()=>await f.session.dispatch.finishCapability(captured),async outcome=>{
    if(outcome.status==="rejected")throw outcome.error;
    return outcome.value;
  });
  f.publicPromise=resource.promise;
  f.result=f.publicPromise;
  return emit({frame:f},params);
}
export function ChooseNext(inputs:any,params:any):any {
  const f=takeFrame(inputs);assertCall(f,f.call);
  return emit(route(f,f.call.requests.length?"request":f.call.finished&&f.call.pending.size===0?"done":"wait"),params);
}
export function TakeRequest(inputs:any,params:any):any {
  const f=takeFrame(inputs),r=f.call.requests.shift();f.result={kind:"request",id:r.id,type:r.type,payload:r.payload};f.nextReady=true;
  return emit({frame:f,done:true},params);
}
export function FinishCall(inputs:any,params:any):any {const f=takeFrame(inputs);f.result={kind:"done",error:f.call.error};f.nextReady=true;return emit({frame:f,done:true},params);}
export function RegisterWake(inputs:any,params:any):any {const f=takeFrame(inputs);f.call.wake=deferred();f.functionWake=f.call.wake;f.nextReady=false;return emit({frame:f,done:false},params);}
export async function WaitRegistered(inputs:any,params:any):Promise<any> {const f=takeFrame(inputs);await f.functionWake.promise;f.call.wake=null;return emit({frame:f},params);}
export function ChooseReady(inputs:any,params:any):any {const f=takeFrame(inputs);return emit(route(f,f.nextReady?"ready":"pending"),params);}
export function FindRequest(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.call=requireCall(f);f.localRequest=f.call.pending.get(Number(f.input.requestId));
  if(!f.localRequest)throw new Error("ERA_FUNCTION_REQUEST_MISSING");return emit({frame:f},params);
}
export function ResolveRequest(inputs:any,params:any):any {const f=takeFrame(inputs);f.call.pending.delete(f.localRequest.id);f.localRequest.resolve(structuredClone(f.input.settlement));return emit({frame:f},params);}
export function ReturnAck(inputs:any,params:any):any {const f=takeFrame(inputs);f.result={status:"acknowledged"};return emit({frame:f},params);}
export function CloseCall(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;f.call=s.functionCalls.get(String(f.input.id));
  if(f.call){s.functionCalls.delete(f.call.id);f.call.active=false;}
  return emit({frame:f},params);
}
export function ChoosePending(inputs:any,params:any):any {const f=takeFrame(inputs);return emit(route(f,f.call?.pending.size?"item":"done"),params);}
export function RejectOne(inputs:any,params:any):any {
  const f=takeFrame(inputs),r=f.call.pending.values().next().value;f.call.pending.delete(r.id);r.reject(new Error("ERA_FUNCTION_CONTEXT_EXPIRED"));
  return emit({frame:f,done:false},params);
}
export function EmptyPending(inputs:any,params:any):any {return emit({frame:takeFrame(inputs),done:true},params);}
export function UnbindContext(inputs:any,params:any):any {
  const f=takeFrame(inputs),c=f.call;
  if(c){f.session.functionContexts.delete(c.parameters);c.releaseResources();c.wake?.resolve();}
  return emit({frame:f},params);
}
export function ReturnRelease(inputs:any,params:any):any {const f=takeFrame(inputs);f.result={status:"released"};return emit({frame:f},params);}
