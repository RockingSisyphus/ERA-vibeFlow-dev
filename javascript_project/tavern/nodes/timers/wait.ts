import {takeFrame,emit,route} from "../../base_lib/frames.ts";
import {linkedSignals} from "../../base_lib/resources.ts";

/** 真实Timeout只存在于此受管Node的挂起作用域。 */
export async function AwaitDue(inputs:any,params:any,context:any):Promise<any> {
  const f=takeFrame(inputs),s=f.session,ticket=f.timerTicket;
  const linked=linkedSignals([context.signal,s.lifecycle.signal,ticket.controller.signal]);
  let handle:any,onAbort:any;
  try {
    f.timerElapsed=await new Promise<boolean>(resolve=>{
      onAbort=()=>resolve(false);linked.signal.addEventListener("abort",onAbort,{once:true});
      if(linked.signal.aborted)onAbort();
      else handle=s.clock.setTimeout(()=>resolve(true),Math.max(0,ticket.dueAt-s.clock.now()));
    });
  } finally {
    if(handle!==undefined)s.clock.clearTimeout(handle);
    linked.signal.removeEventListener("abort",onAbort);linked.cleanup();
  }
  return emit(route(f,f.timerElapsed?"due":"cancelled"),params);
}
export function DispatchDue(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  f.result=f.session.dispatch.timerFired({session:f.session,input:{kind:f.timerKind,key:f.timerKey,handle:f.timerTicket,event:f.timerEvent,barrier:f.timerBarrier}}).result;
  return emit({frame:f},params);
}
export function Cancelled(inputs:any,params:any):any {const f=takeFrame(inputs);f.result=undefined;return emit({frame:f},params);}
