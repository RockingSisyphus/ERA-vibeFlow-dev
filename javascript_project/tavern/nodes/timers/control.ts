import {takeFrame,emit,route} from "../../base_lib/frames.ts";
import {record} from "../../base_lib/browser.ts";

export function ReadTimer(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;
  f.timerKind=f.timerCommand?"collection":"delayed";
  f.timerInput=f.timerCommand??f.input;
  f.timerMap=f.timerKind==="collection"?s.timers:s.delayedAdmissions;
  f.timerKey=f.timerKind==="collection"?f.timerInput.token:String(f.timerInput.key);
  f.timerOperation=f.timerKind==="collection"?f.timerInput.kind:f.operation;
  f.previousTimer=f.timerMap.get(f.timerKey);
  if(f.timerKind==="delayed"&&f.timerOperation==="schedule") {
    const i=f.timerInput;
    if(typeof i.key!=="string"||!i.key||!record(i.event)||!Number.isFinite(i.delayMs)||i.delayMs<0||!Number.isFinite(i.maxDelayMs)||i.maxDelayMs<i.delayMs)
      throw new TypeError("延迟准入缺少有效事件、键或时间窗口。");
    f.firstAt=f.previousTimer?.firstAt??s.clock.now();
  }
  return emit({frame:f},params);
}
export function ChooseTimer(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  return emit(route(f,f.timerOperation==="cancel"?"cancel":f.timerKind==="collection"&&f.previousTimer?.dueAt===f.timerInput.dueAt?"keep":"schedule"),params);
}

export function CancelTimer(inputs:any,params:any):any {
  const f=takeFrame(inputs);if(f.previousTimer)f.previousTimer.handle.controller.abort("cancelled");f.timerMap.delete(f.timerKey);f.session.timerRevision++;f.session.timerWake?.resolve();return emit({frame:f},params);
}
export function ReturnTimer(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.result=f.timerKind==="collection"?null:f.timerOperation==="cancel"?{status:"cancelled"}:{status:"scheduled",dueAt:f.timerDueAt};return emit({frame:f},params);
}
export function PrepareCommands(inputs:any,params:any):any {const f=takeFrame(inputs);f.commands=f.outputFrame.commands;f.itemIndex=0;return emit({frame:f},params);}
export function ChooseCommand(inputs:any,params:any):any {const f=takeFrame(inputs);return emit(route(f,f.itemIndex<f.commands.length?"item":"done"),params);}
export function PrepareCommand(inputs:any,params:any):any {const f=takeFrame(inputs);f.timerCommand=f.commands[f.itemIndex];return emit({frame:f},params);}
export function AdvanceCommand(inputs:any,params:any):any {const f=takeFrame(inputs);f.itemIndex++;return emit({frame:f,done:false},params);}
export function EmptyCommands(inputs:any,params:any):any {return emit({frame:takeFrame(inputs),done:true},params);}
export function ReturnControl(inputs:any,params:any):any {const f=takeFrame(inputs);f.result=null;return emit({frame:f},params);}

export function ScheduleTimer(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;
  f.previousTimer?.handle.controller.abort("replaced");
  f.timerDueAt=f.timerKind==="collection"?f.timerInput.dueAt:
    Math.min(s.clock.now()+f.timerInput.delayMs,f.firstAt+f.timerInput.maxDelayMs);
  const ticket={controller:new AbortController(),dueAt:f.timerDueAt};
  f.timerMap.set(f.timerKey,{handle:ticket,dueAt:f.timerDueAt,firstAt:f.firstAt});
  s.timerRequests.add({timerKind:f.timerKind,timerKey:f.timerKey,timerTicket:ticket,timerEvent:f.timerInput.event});
  s.timerRevision++;s.timerWake?.resolve();return emit({frame:f},params);
}
export function RegisterWatchdog(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;
  if(s.watchdogMs>0&&f.barrier.records.some((r:any)=>!r.settled)){
    const ticket={controller:new AbortController(),dueAt:s.clock.now()+s.watchdogMs};
    f.watchdog=ticket;s.watchdogs.add(ticket);
    s.timerRequests.add({timerKind:"watchdog",timerTicket:ticket,timerBarrier:f.barrier});
    s.timerRevision++;s.timerWake?.resolve();
  }
  return emit({frame:f},params);
}
