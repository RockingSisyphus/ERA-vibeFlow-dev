import {takeFrame,emit,route} from "../../base_lib/frames.ts";
export async function AwaitReceipt(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs);f.originalSettlement=await f.originalReceipt;
  return emit({frame:f},params);
}
export function Choose(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.completionId=f.originalSettlement.value?.completionId;
  return emit(route(f,f.completionId?"handoff":"original"),params);
}
export function Original(inputs:any,params:any):any {const f=takeFrame(inputs);f.result=f.originalSettlement;return emit({frame:f},params);}
export async function AwaitHandoff(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs);f.finalSettlement=await (f.session.handoffs.get(f.completionId)?.promise??null);
  return emit({frame:f},params);
}
export function ChooseFinal(inputs:any,params:any):any {const f=takeFrame(inputs);return emit(route(f,f.finalSettlement?"completed":"cancelled"),params);}
export function Completed(inputs:any,params:any):any {
  const f=takeFrame(inputs),original=f.originalSettlement;
  f.result={...f.finalSettlement,eventId:original.eventId,sequence:original.sequence};return emit({frame:f},params);
}
export function Cancelled(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.result={...f.originalSettlement,status:"cancelled",reason:"生成会话已取消"};return emit({frame:f},params);
}
