import {takeFrame,emit,route} from "../../base_lib/frames.ts";
export function CheckPending(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.completionId=f.completion.completionId;
  f.handoffPending=f.session.handoffs.has(f.completionId);f.handoffFinal=null;f.handoffFailed=false;
  return emit({frame:f},params);
}
export function ChoosePending(inputs:any,params:any):any {const f=takeFrame(inputs);return emit(route(f,f.handoffPending?"pending":"missing"),params);}
export async function PublishCompletion(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs);
  try {f.proceed=await f.proceedPromise;}catch(error){f.handoffFailed=true;f.handoffError=error;}
  return emit({frame:f},params);
}
export function CheckCancel(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.handoffCancelled=f.handoffSignal.aborted||!f.session.handoffs.has(f.completionId);
  return emit({frame:f},params);
}
export function ChooseContinue(inputs:any,params:any):any {
  const f=takeFrame(inputs);return emit(route(f,f.handoffFailed?"failed":f.handoffCancelled?"cancelled":"admit"),params);
}
export function PrepareContinue(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.input={type:"era.agent.stage_continue",source:"era-api",args:[{completionId:f.completionId,...(!f.proceed?{cancelled:true}:{})}]};
  return emit({frame:f},params);
}
export function CaptureAdmission(inputs:any,params:any):any {const f=takeFrame(inputs);f.continueAdmission=f.result;return emit({frame:f},params);}
export function ChooseAdmission(inputs:any,params:any):any {const f=takeFrame(inputs);return emit(route(f,f.continueAdmission.accepted?"accepted":"rejected"),params);}
export async function AwaitContinue(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs);
  try {f.continueSettlement=await f.continueAdmission.done;}catch(error){f.handoffFailed=true;f.handoffError=error;}
  return emit({frame:f},params);
}
export function ChooseFollowup(inputs:any,params:any):any {
  const f=takeFrame(inputs);return emit(route(f,f.handoffFailed||!f.proceed?"cancel":f.continueSettlement.value?.completionId?"next":"current"),params);
}
export function SelectCurrent(inputs:any,params:any):any {const f=takeFrame(inputs);f.handoffFinal=f.continueSettlement;return emit({frame:f},params);}
export function SelectNext(inputs:any,params:any):any {const f=takeFrame(inputs);f.followupId=f.continueSettlement.value.completionId;return emit({frame:f},params);}
export function SelectCancel(inputs:any,params:any):any {const f=takeFrame(inputs);f.handoffFinal=null;return emit({frame:f},params);}
export async function AwaitFollowup(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs);
  if(f.followupId){
    try {f.handoffFinal=await(f.session.handoffs.get(f.followupId)?.promise??null);}
    catch(error){f.handoffFinal=null;f.handoffFailed=true;f.handoffError=error;}
  }
  return emit({frame:f},params);
}
export function FinishMissing(inputs:any,params:any):any {const f=takeFrame(inputs);f.handoffFinal=null;return emit({frame:f},params);}
export function FinishCancelled(inputs:any,params:any):any {const f=takeFrame(inputs);f.handoffFinal=null;return emit({frame:f},params);}
export function FinishFailed(inputs:any,params:any):any {const f=takeFrame(inputs);f.handoffFinal=null;return emit({frame:f},params);}
export function FinishRejected(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.handoffFinal=null;f.handoffFailed=true;f.handoffError=new Error(f.continueAdmission.message);
  return emit({frame:f},params);
}
export function FinishHandoff(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;s.handoffs.get(f.completionId)?.resolve(f.handoffFinal);s.handoffs.delete(f.completionId);
  f.notificationOutcome=f.handoffFailed?{status:"rejected",reason:f.handoffError}:{status:"fulfilled",value:undefined};
  f.result=undefined;return emit({frame:f},params);
}
