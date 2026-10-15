import {takeFrame,emit,route} from "../../base_lib/frames.ts";
import {browserHosts} from "../../base_lib/browser.ts";

function stopNative(api:any):boolean {
  for(const host of browserHosts(api)){
    const tavern=host.SillyTavern,context=tavern?.getContext?.();
    if(typeof context?.stopGeneration==="function")return context.stopGeneration()===true;
    if(typeof tavern?.stopGeneration==="function")return tavern.stopGeneration()===true;
  }
  return false;
}
export function ExecuteStop(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api;
  const auxiliaryStopped=api.stopAllGeneration();const nativeStopped=stopNative(api);
  f.result={status:nativeStopped?"stopped":"deferred",nativeStopped,auxiliaryStopped};return emit({frame:f},params);
}
export function ChooseStop(inputs:any,params:any):any {const f=takeFrame(inputs);return emit(route(f,f.result.nativeStopped?"stopped":"deferred"),params);}
export function ClearStop(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.session.nativeStopTicket?.release();f.session.nativeStopTicket=null;return emit({frame:f},params);
}
export function ArmStop(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session; s.nativeStopTicket?.release();
  const ticket:any={};s.nativeStopTicket=ticket;
  ticket.release=s.resources.once(s.api.tavern_events.GENERATION_AFTER_COMMANDS,()=>s.dispatch.nativeStopRetry({session:s,input:{ticket}}));
  return emit({frame:f},params);
}
export function ChooseRetry(inputs:any,params:any):any {
  const f=takeFrame(inputs);return emit(route(f,!f.session.stopping&&f.input.ticket===f.session.nativeStopTicket?"active":"stale"),params);
}
export function AttemptRetry(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.input.ticket.release();f.session.nativeStopTicket=null;
  f.result=stopNative(f.session.api);return emit({frame:f},params);
}
export function IgnoreRetry(inputs:any,params:any):any {const f=takeFrame(inputs);f.result=undefined;return emit({frame:f},params);}
