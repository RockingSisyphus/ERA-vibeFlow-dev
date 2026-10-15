import {takeFrame,emit} from "../../base_lib/frames.ts";
import {currentTavern} from "../../base_lib/browser.ts";
import {startResource,resourceValue,rawCall} from "../../base_lib/resources.ts";
export function StartRefresh(inputs:any,params:any):any {
  const f=takeFrame(inputs),t=currentTavern(f.session.api);f.refreshTavern=t;
  if(f.input.kind==="empty")t.chat.push({name:t.name2,is_user:false,is_system:false,mes:f.input.next,extra:{}});
  else{const message=t.chat[0];message.mes=f.input.updated;if(Array.isArray(message.swipes))message.swipes[0]=f.input.updated;}
  f.operationResource=startResource(f,()=>t.eventSource.emit(t.eventTypes.MESSAGE_RECEIVED,0,"first_message"),r=>f.session.dispatch.finishCapability({...f,operationResource:r}));
  f.publicPromise=f.operationResource.publicPromise;return emit({frame:f},params);
}
export async function AwaitReceived(inputs:any,params:any):Promise<any> {const f=takeFrame(inputs);await resourceValue(f);return emit({frame:f},params);}
export async function ClearDisplay(inputs:any,params:any):Promise<any> {const f=takeFrame(inputs);await rawCall(f,()=>f.refreshTavern.clearChat());return emit({frame:f},params);}
export async function PrintMessages(inputs:any,params:any):Promise<any> {const f=takeFrame(inputs);await rawCall(f,()=>f.refreshTavern.printMessages());return emit({frame:f},params);}
export async function EmitRendered(inputs:any,params:any):Promise<any> {const f=takeFrame(inputs);await rawCall(f,()=>f.refreshTavern.eventSource.emit(f.refreshTavern.eventTypes.CHARACTER_MESSAGE_RENDERED,0,"first_message"));return emit({frame:f},params);}
export async function SaveChat(inputs:any,params:any):Promise<any> {const f=takeFrame(inputs);await rawCall(f,()=>f.refreshTavern.saveChat());f.result={status:"refreshed",reason:"纯净主开场白已同步到当前首楼并完成重绘。"};return emit({frame:f},params);}
