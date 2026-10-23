import {takeFrame,emit,route,warn} from "../../base_lib/frames.ts";
export function ReadNotification(inputs:any,params:any):any {return emit({frame:takeFrame(inputs)},params);}
export function ChooseNotification(inputs:any,params:any):any {const f=takeFrame(inputs);return emit(route(f,f.notification.type==="era.agent.stage_completed"?"handoff":"event"),params);}
export async function SelectEvent(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs);
  try {f.notificationValue=await f.notificationResource.promise;f.notificationOutcome={status:"fulfilled",value:f.notificationValue};}
  catch(reason){f.notificationOutcome={status:"rejected",reason};}
  return emit({frame:f},params);
}
export async function SelectHandoff(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs);
  try {const terminal=await f.notificationResource.promise;f.notificationOutcome=terminal?.notificationOutcome??{status:"fulfilled",value:undefined};}
  catch(reason){f.notificationOutcome={status:"rejected",reason};}
  return emit({frame:f},params);
}
export async function EmitNotification(inputs:any,params:any):Promise<any> {return emit({frame:takeFrame(inputs)},params);}
export function RecordResult(inputs:any,params:any):any {
  const f=takeFrame(inputs),group=f.notificationGroup;group.outcomes[f.notificationIndex]=f.notificationOutcome;group.remaining--;
  return emit({frame:f},params);
}
export function ChooseComplete(inputs:any,params:any):any {const f=takeFrame(inputs);return emit(route(f,f.notificationGroup.remaining?"pending":"complete"),params);}
export function ScheduleFinish(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;s.notificationEvents.push({kind:"notification_finalize",notificationGroup:f.notificationGroup});s.notificationWake?.resolve();
  return emit({frame:f},params);
}
export function ReadGroup(inputs:any,params:any):any {const f=takeFrame(inputs);f.reportIndex=0;return emit({frame:f},params);}
export function ChooseReport(inputs:any,params:any):any {const f=takeFrame(inputs);return emit(route(f,f.reportIndex<f.notificationGroup.outcomes.length?"item":"done"),params);}
export function EmptyReport(inputs:any,params:any):any {return emit({frame:takeFrame(inputs),done:true},params);}
export function ReportOne(inputs:any,params:any):any {
  const f=takeFrame(inputs),outcome=f.notificationGroup.outcomes[f.reportIndex++];
  if(outcome.status==="rejected")warn(f.session,"ERA 后置通知失败；状态结算不受影响。",{error:outcome.reason instanceof Error?outcome.reason.message:String(outcome.reason)});
  return emit({frame:f,done:false},params);
}
export function ReleaseGroup(inputs:any,params:any):any {
  const f=takeFrame(inputs),group=f.notificationGroup;group.linked.cleanup();f.session.notificationGroups?.delete(group);f.session.activeNotifications.delete(group.completion.promise);group.completion.resolve();
  return emit({frame:{status:"notifications-released"}},params);
}
