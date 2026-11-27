import {takeFrame, emit, route} from "../../base_lib/frames.ts";
import {deferred, linkedSignals, abortable} from "../../base_lib/resources.ts";

/** 只等待本职责队列到达或关闭；实际调用由下游显式Nodeset执行。 */
async function waitInbox(s:any, queue:any[], key:string, signal:AbortSignal):Promise<void> {
  if(queue.length || s.stopping || s.lifecycle.signal.aborted)return;
  const waiter=deferred();s[key]=waiter;
  try {await abortable(()=>waiter.promise,linkedSignals([signal,s.lifecycle.signal]));}
  catch(error){if(!s.lifecycle.signal.aborted)throw error;}
  finally {if(s[key]===waiter)s[key]=null;}
}
export async function TakeAuthor(inputs:any,params:any,context:any):Promise<any> {
  const f=takeFrame(inputs),s=f.session;
  await waitInbox(s,s.authorCalls,"authorWake",context.signal);
  return emit(route((s.stopping||s.lifecycle.signal.aborted)?{action:"runtime",session:s}:{...s.authorCalls.shift(),session:s},(s.stopping||s.lifecycle.signal.aborted)?"stop":"work"),params);
}
export async function TakeNotification(inputs:any,params:any,context:any):Promise<any> {
  const f=takeFrame(inputs),s=f.session;
  await waitInbox(s,s.notificationEvents,"notificationWake",context.signal);
  if(s.stopping||s.lifecycle.signal.aborted)return emit(route({action:"runtime",session:s},"stop"),params);
  const event=s.notificationEvents.shift();
  return emit(route({...event,session:s},event.kind==="notification_finalize"?"finalize":"work"),params);
}
export function SelectTimer(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;
  for(const item of s.timerRequests)if(item.timerTicket.controller.signal.aborted)s.timerRequests.delete(item);
  let earliest:any;
  for(const item of s.timerRequests)if(!earliest||item.timerTicket.dueAt<earliest.timerTicket.dueAt)earliest=item;
  return emit(route({session:s,...earliest,timerRequest:earliest,timerRevision:s.timerRevision},(s.stopping||s.lifecycle.signal.aborted)?"stop":"work"),params);
}
/** 下游执行真实退出后，才把同一实例交回下一轮；结果不保存到Session。 */
export function Advance(inputs:any,params:any):any {
  const f=inputs["era.tavern.call.frame"].value;
  return emit({frame:{action:"runtime",session:f.session},done:false},params);
}
export function EndLoop(inputs:any,params:any):any {
  takeFrame(inputs);return emit({frame:{status:"branch-ended"},done:true},params);
}
export function Collect(inputs:any,params:any):any {
  const results=inputs["era.tavern.task.finished"];
  if(results.length!==5)throw new Error("五个职责分支必须全部实际退出后才能返回。");
  return emit({frame:{status:"stopped"}},params);
}

export function Dispatch(inputs:any,params:any):any {
  return emit({frame:{...inputs["era.tavern.call.frame"].value}},params);
}
