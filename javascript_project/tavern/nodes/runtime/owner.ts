import {takeFrame,emit,route,EraServiceHostError} from "../../base_lib/frames.ts";
import {deferred,abortable,linkedSignals} from "../../base_lib/resources.ts";

/** 仅持有实际资源；队列分类、任务启动和结算均在外部原生流程中。 */
export async function HoldResources(inputs:any,params:any,context:any):Promise<any> {
  const f=takeFrame(inputs),s=f.session,pending=new Set<Promise<any>>(),releases=new Set<()=>void>();
  let live=true;
  const errors:any[]=[];
  const track=(value:any)=>{
    const work=Promise.resolve(value);pending.add(work);
    work.then(()=>pending.delete(work),()=>pending.delete(work));return work;
  };
  const cleanupResource=(cleanup:()=>any)=>{
    try{return track(Promise.resolve(cleanup()).catch(error=>{errors.push(error);}));}
    catch(error){errors.push(error);}
  };
  const releaseAll=()=>{for(const release of [...releases])cleanupResource(release);};
  const keep=(cleanup:()=>void)=>{
    if(!live){cleanupResource(cleanup);throw new EraServiceHostError("ERA_HOST_STOPPED","资源作用域已关闭。");}
    let active=true;
    const release=()=>{if(active){active=false;releases.delete(release);return cleanup();}};
    releases.add(release);return release;
  };
  const listen=(type:string,callback:any,order:string)=>{
    const release=keep(()=>s.api.eventRemoveListener(type,callback));
    const method=order==="first"?"eventMakeFirst":order==="last"?"eventMakeLast":"eventOn";
    try{s.api[method](type,callback);}catch(error){release();throw error;}
    return release;
  };
  const once=(type:string,callback:any)=>{
    let handle:any;const release=keep(()=>handle?.stop());
    try{handle=s.api.eventOnce(type,callback);}catch(error){release();throw error;}
    return release;
  };
  s.resources={listen,once,onSettled:(work:Promise<any>,callback:()=>void)=>track(Promise.resolve(work).then(callback,callback)),perform:(operation:()=>any)=>{
    if(!live)throw new EraServiceHostError("ERA_HOST_STOPPED","资源作用域已关闭。");
    return track(operation());
  },track,keep,discard:(value:any)=>track(Promise.resolve(value).then(()=>undefined)),mount:(create:()=>Promise<()=>void>)=>{
    const ready=Promise.resolve().then(()=>{s.lifecycle.signal.throwIfAborted();return create();}).then(cleanup=>{
      if(live)keep(cleanup);else return cleanupResource(cleanup);
    });
    track(ready);ready.catch(error=>{if(!s.lifecycle.signal.aborted)stopped.reject(error);});
  }};
  const target=s.api.window;
  const onPagehide=()=>{
    try{s.dispatch.stopPrefix({session:s,input:{reason:"script-unloaded"}});}catch(error){stopped.reject(error);}
    finally{live=false;s.lifecycle.abort("script-unloaded");releaseAll();}
  };
  const stopped=deferred();
  const onAbort=()=>stopped.resolve();
  try {
    target?.addEventListener("pagehide",onPagehide,{once:true});
    context.signal.addEventListener("abort",onAbort,{once:true});
    s.lifecycle.signal.addEventListener("abort",onAbort,{once:true});
    if(context.signal.aborted||s.lifecycle.signal.aborted)onAbort();
    s.ownerReady.resolve();
    await stopped.promise;
    return emit({frame:{status:"resources-closed"}},params);
  } finally {
    live=false;
    s.lifecycle.abort(context.signal.reason??"runtime-ended");
    s.operational.abort(context.signal.reason??"runtime-ended");
    target?.removeEventListener("pagehide",onPagehide);
    context.signal.removeEventListener("abort",onAbort);
    s.lifecycle.signal.removeEventListener("abort",onAbort);
    try {s.dispatch.stopPrefix({session:s,input:{reason:context.signal.reason??"runtime-ended"}});}catch(error){errors.push(error);}
    releaseAll();
    // Pending contains actual IO and its compiled continuation, including non-cancellable operations.
    while(pending.size)await Promise.allSettled([...pending]);
    for(const group of s.notificationGroups??[]){group.linked.cleanup();group.completion.resolve();}
    s.notificationGroups?.clear();s.activeNotifications.clear();
    s.resources=undefined;
    s.authorCalls.length=0;s.notificationEvents.length=0;s.timerRequests.clear();
    try{await s.onDispose?.();}catch(error){errors.push(error);}
    s.queue.length=0;s.queueBytes=0;s.refs.clear();s.refsBySequence.clear();
    s.failureLedger.clear();s.processedFrames.clear();
    s.fatalTransitioning=false;s.fatalLatched=false;
    if(errors.length)throw new AggregateError(errors,"ERA 资源清理失败，其余资源已完成收尾。");
  }
}
export async function WaitOwner(inputs:any,params:any,context:any):Promise<any> {
  const f=takeFrame(inputs);
  const s=f.session;
  context.signal.throwIfAborted();
  if(!s.stopping&&!s.lifecycle.signal.aborted) {
    try {await abortable(()=>s.ownerReady.promise,linkedSignals([context.signal,s.lifecycle.signal]));}
    catch(error){if(context.signal.aborted||!s.lifecycle.signal.aborted)throw error;}
  }
  return emit({frame:f},params);
}
export function BindSession(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.session.dispatch.bindSession(f);return emit({frame:f},params);
}
export async function RunService(inputs:any,params:any,context:any):Promise<any> {
  const f=takeFrame(inputs),s=f.session,linked=linkedSignals([context.signal,s.lifecycle.signal]);
  try {await s.dispatch.runService({}, {signal:linked.signal});}
  catch(error){if(!linked.signal.aborted)throw error;}
  finally {linked.cleanup();s.dispatch.stopPrefix({session:s,input:{reason:"service-ended"}});}
  return emit({frame:{status:"service-ended"}},params);
}
export function ClaimClose(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,existing=s.cleanupStarted===true;
  s.cleanupStarted=true;return emit(route(f,existing?"existing":"first"),params);
}
export function ReuseClose(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.result={closed:true};return emit({frame:f},params);
}
