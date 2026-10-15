import type {TaskManagerContext} from "@vibeflow/plugin";
import {takeFrame,emit,route} from "../../base_lib/frames.ts";

/** 所有引用只随本次运行的Loop传递，Session不持有任务控制资料。 */
export function ChooseNext(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  f.runtimeScope??={entries:[],ownerStarted:false,serviceStarted:false,closing:false};
  const scope=f.runtimeScope,s=f.session;f.kind="continue";
  let next;
  if(!scope.ownerStarted)next="lifecycle";
  else if(s.stopping&&!scope.closing)next="close";
  else if(!scope.serviceStarted&&!scope.closing)next="service";
  else if(scope.closing&&!s.tasks.length)next=scope.entries.some((e:any)=>!["lifecycle","inbox"].includes(e.role))?"wait":"exit";
  else if(!scope.entries.some((e:any)=>e.role==="inbox"))next="inbox";
  else next="wait";
  f.runtimeNext=next;return emit(route(f,next),params);
}
export function PrepareInbox(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.launchSlot=f.runtimeNext;
  if(f.launchSlot==="lifecycle")f.runtimeScope.ownerStarted=true;
  if(f.launchSlot==="service")f.runtimeScope.serviceStarted=true;
  f.launchFrame={session:f.session};return emit({frame:f},params);
}
export function PrepareWorker(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.launchSlot=f.backgroundTask.kind;
  f.launchFrame={...f.backgroundTask,session:f.session};
  return emit({frame:f},params);
}
/** 唯一启动边界；分类和资料准备已由普通Node完成。 */
export function Launch(inputs:any,params:any,context:TaskManagerContext):any {
  const f=takeFrame(inputs);
  const ref=context.tasks.start(f.launchSlot,{"era.tavern.call.frame":f.launchFrame});
  f.runtimeScope.entries.push({ref,role:f.launchSlot});
  delete f.launchFrame;delete f.launchSlot;delete f.backgroundTask;
  f.kind="continue";return emit({frame:f},params);
}
/** 唯一结果等待边界；结果分类不在此处执行。 */
export async function WaitAny(inputs:any,params:any,context:TaskManagerContext):Promise<any> {
  const f=takeFrame(inputs);
  f.runtimeOutcome=await context.tasks.waitAny(f.runtimeScope.entries.map((entry:any)=>entry.ref));
  return emit({frame:f},params);
}
export function ChooseResult(inputs:any,params:any):any {
  const f=takeFrame(inputs),outcome=f.runtimeOutcome;
  f.runtimeEntry=f.runtimeScope.entries.find((entry:any)=>entry.ref.task_id===outcome?.task.task_id);
  if(!outcome||!f.runtimeEntry)throw new Error("后台等待返回了未登记的任务结果。");
  const inbox=f.runtimeEntry.role==="inbox",service=f.runtimeEntry.role==="service";
  if(service&&outcome.status!=="failed"){
    f.runtimeScope.entries=f.runtimeScope.entries.filter((e:any)=>e!==f.runtimeEntry);
    delete f.runtimeOutcome;delete f.runtimeEntry;
    return emit(route(f,"closing"),params);
  }
  return emit(route(f,outcome.status==="failed"||inbox&&outcome.status!=="succeeded"?"failed":inbox?"inbox":"completed"),params);
}
export function ReadInbox(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  f.backgroundTask=f.session.tasks.shift()??(f.session.stopping?{kind:"stop"}:null);
  if(!f.backgroundTask)throw new Error("收件任务完成但队列中没有请求。");
  f.runtimeScope.entries=f.runtimeScope.entries.filter((entry:any)=>entry.ref.task_id!==f.runtimeEntry.ref.task_id);
  delete f.runtimeOutcome;delete f.runtimeEntry;
  return emit({frame:f},params);
}
export function Collect(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  f.runtimeScope.entries=f.runtimeScope.entries.filter((entry:any)=>entry.ref.task_id!==f.runtimeEntry.ref.task_id);
  delete f.runtimeOutcome;delete f.runtimeEntry;
  f.kind="continue";return emit({frame:f},params);
}
export function MarkFailure(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.runtimeFailure=f.runtimeOutcome.error??{
    code:"ERA_RUNTIME_INBOX_CANCELLED",message:"后台收件任务在正常停止前意外取消。",
  };
  f.runtimeScope.entries=f.runtimeScope.entries.filter((entry:any)=>entry.ref.task_id!==f.runtimeEntry.ref.task_id);
  delete f.runtimeOutcome;delete f.runtimeEntry;
  f.kind="stop";return emit({frame:f},params);
}
/** 唯一收尾控制边界：请求停止与等待真实退出必须成对完成。 */
export async function StopAndWait(inputs:any,params:any,context:TaskManagerContext):Promise<any> {
  const f=takeFrame(inputs),refs=f.runtimeScope.entries.map((entry:any)=>entry.ref);
  f.stopAcks=context.tasks.requestStop(refs,f.runtimeFailure?.message??"ERA 后台运行停止");
  f.stopOutcomes=await context.tasks.waitAllExited(refs);
  f.runtimeScope.entries=[];return emit({frame:f},params);
}
export function ChooseExit(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  f.runtimeErrors=[...(f.runtimeFailure?[f.runtimeFailure]:[]),
    ...f.stopOutcomes.filter((outcome:any)=>outcome.status==="failed").map((outcome:any)=>outcome.error)];
  f.kind="stop";return emit(route(f,f.runtimeErrors.length?"failed":"stopped"),params);
}
export function RaiseFailure(inputs:any):never {
  const f=takeFrame(inputs);
  const error=new AggregateError(f.runtimeErrors,"ERA 后台任务失败，受管任务已完成退出与清理。");
  f.session.onRuntimeFailure?.(error);throw error;
}

export function BeginClosing(inputs:any,params:any):any {
 const f=takeFrame(inputs);f.runtimeScope.closing=true;f.kind="continue";return emit({frame:f},params);
}
