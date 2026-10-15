import {takeFrame,emit,route,warn} from "../../base_lib/frames.ts";
import {ERA_COLLECTION_TIMER_EVENT_TYPE} from "../../base_lib/contracts.ts";
export function CheckTimer(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,i=f.input;
  f.timerKind=i.kind;f.timerMap=i.kind==="collection"?s.timers:s.delayedAdmissions;
  const current=f.timerMap.get(i.key);
  f.timerValid=i.kind==="watchdog"?s.watchdogs.has(i.handle):!!current&&current.handle===i.handle;
  return emit({frame:f},params);
}
export function ChooseKind(inputs:any,params:any):any {const f=takeFrame(inputs);return emit(route(f,!f.timerValid?"stale":f.timerKind==="watchdog"?"watchdog":"admit"),params);}
export function PrepareEvent(inputs:any,params:any):any {
  const f=takeFrame(inputs),i=f.input;f.firedTimerInput=i;f.timerMap.delete(i.key);
  f.input=i.kind==="collection"?{type:ERA_COLLECTION_TIMER_EVENT_TYPE,source:"timer",occurredAt:f.session.clock.now(),args:[i.key]}:i.event;
  return emit({frame:f},params);
}
export function ReturnEvent(inputs:any,params:any):any {
  const f=takeFrame(inputs),i=f.firedTimerInput;
  if(!f.result.accepted)warn(f.session,i.kind==="collection"?"收集定时器事件未被接纳。":"延迟事件准入失败。",i.kind==="collection"?{token:i.key,code:f.result.code,message:f.result.message}:{key:i.key,code:f.result.code});
  return emit({frame:f},params);
}
export function WarnWatchdog(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,b=f.input.barrier;s.watchdogs.delete(f.input.handle);
  const pendingSequences=b.records.filter((r:any)=>!r.settled).map((r:any)=>r.event.sequence);
  if(pendingSequences.length)warn(s,"ERA 高水位屏障等待超过告警阈值；不会自动放行。",{throughSequence:b.sequence,pendingSequences,elapsedMs:s.clock.now()-b.startedAt});
  return emit({frame:f},params);
}
