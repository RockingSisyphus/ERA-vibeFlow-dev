import {takeFrame, emit, route} from "../../base_lib/frames.ts";
import {linkedSignals, abortable} from "../../base_lib/resources.ts";

/** 只读数据转换；回调执行与遍历由下面的节点和原生Loop负责。 */
function freezeResult(value:any):any {
  if(value&&typeof value==="object"){
    for(const child of Object.values(value))freezeResult(child);
    Object.freeze(value);
  }
  return value;
}
export function ChooseControl(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  if(!["register","stop","cancel"].includes(f.operation))throw new TypeError("未知阶段订阅操作。");
  return emit(route(f,f.operation),params);
}
export function Register(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;
  if(typeof f.input.listener!=="function")throw new TypeError("阶段订阅需要函数。");
  const stages=f.input.options?.stages;
  if(stages?.some((stage:any)=>!["planning","story","settlement"].includes(stage)))throw new TypeError("未知生成阶段。");
  const item={owner:s,listener:f.input.listener,stages:stages?[...stages]:undefined,lifecycle:new AbortController(),waiting:new Set<any>()};
  s.subscriptions??=new Set();s.subscriptionCycles??=new Set();s.subscriptions.add(item);
  const stop=()=>s.resources&&s.dispatch.subscriptionControl({session:s,action:"subscription_control",operation:"stop",input:{item}});
  f.result=Object.assign(stop,{cancelPending:()=>s.resources&&s.dispatch.subscriptionControl({session:s,action:"subscription_control",operation:"stop",input:{item,cancelPending:true}})});
  return emit({frame:f},params);
}
export function Stop(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,item=f.input.item;
  if(item?.owner!==s)throw new TypeError("订阅资源不属于当前实例。");
  if(f.input.cancelPending)for(const cycle of item.waiting)cycle.abort();
  s.subscriptions.delete(item);item.lifecycle.abort();f.result=undefined;
  return emit({frame:f},params);
}
export function Cancel(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;
  for(const cycle of s.subscriptionCycles??[])cycle.controller.abort();
  if(f.input?.clear){
    for(const item of s.subscriptions??[])item.lifecycle.abort();
    s.subscriptions?.clear();
  }
  f.result=undefined;return emit({frame:f},params);
}
export function ReadCycle(inputs:any,params:any):any {
  const f=takeFrame(inputs),cycle=f.subscriptionCycle;
  if(cycle?.owner!==f.session)throw new TypeError("订阅周期不属于当前实例。");
  f.subscriptionIndex=0;f.readonlyCompletion=freezeResult(structuredClone(cycle.completion));
  return emit({frame:f},params);
}
export function ChooseItem(inputs:any,params:any):any {
  const f=takeFrame(inputs),c=f.subscriptionCycle;
  if(c.controller.signal.aborted||f.subscriptionIndex>=c.items.length)return emit(route(f,"done"),params);
  f.subscription=c.items[f.subscriptionIndex];
  const item=f.subscription;
  return emit(route(f,!f.session.subscriptions.has(item)||(item.stages&&!item.stages.includes(c.completion.stage))?"skip":"invoke"),params);
}
export function Skip(inputs:any,params:any):any {const f=takeFrame(inputs);f.subscriptionIndex++;return emit({frame:f,done:false},params);}
export function Empty(inputs:any,params:any):any {return emit({frame:takeFrame(inputs),done:true},params);}
export async function Invoke(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs),c=f.subscriptionCycle,item=f.subscription;
  const linked=linkedSignals([c.controller.signal,item.lifecycle.signal]);f.subscriptionSignal=linked.signal;
  item.waiting.add(c.controller);f.subscriptionFailed=false;f.subscriptionError=undefined;
  try {
    await abortable(()=>f.session.resources.perform(()=>Promise.resolve().then(()=>{
      if(!linked.signal.aborted)return item.listener(Object.freeze({...f.readonlyCompletion,signal:linked.signal}));
    })),linked);
  } catch(error){f.subscriptionFailed=true;f.subscriptionError=error;}
  return emit({frame:f},params);
}
export function Classify(inputs:any,params:any):any {
  const f=takeFrame(inputs);return emit(route(f,f.subscriptionFailed&&!f.subscriptionSignal.aborted?"error":"quiet"),params);
}
export function ReportError(inputs:any,params:any):any {
  const f=takeFrame(inputs),error=f.subscriptionError;
  f.session.log.error("ERA 阶段订阅失败，继续后续生成。",error);
  f.session.api.toastr?.error(`阶段订阅失败，继续后续生成：${error instanceof Error?error.message:String(error)}`);
  return emit({frame:f},params);
}
export function Advance(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.subscription.waiting.delete(f.subscriptionCycle.controller);f.subscriptionIndex++;
  return emit({frame:f,done:false},params);
}
export function ReleaseCycle(inputs:any,params:any):any {
  const f=takeFrame(inputs),c=f.subscriptionCycle;
  f.session.subscriptionCycles.delete(c);f.result=!c.controller.signal.aborted;
  return emit({frame:f},params);
}
