import {takeFrame,emit} from "../../base_lib/frames.ts";
import {identity,record} from "../../base_lib/browser.ts";
import {startResource,resourceValue,abortable,linkedSignals,syncCall} from "../../base_lib/resources.ts";

export function CheckIdentity(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  if(typeof f.input.chatId!=="string"||typeof f.input.executionId!=="string")
    throw new TypeError("原生生成收尾等待缺少聊天及执行来源。");
  return emit({frame:f},params);
}
/** 登记时捕获唯一执行，不能在等待阶段借用后来新建的生成。 */
export function StartOperation(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,cycle=s.nativeCycle,session=s.sessions.get(f.input.chatId);
  const nonNative=record(session)&&session.nativeGeneration===false;
  const current=cycle?.identity.chatId===f.input.chatId&&cycle.identity.executionId===f.input.executionId;
  f.operationResource=startResource(f,signal=>nonNative?{status:"not-native"}:
    current?abortable(()=>cycle.promise,linkedSignals([signal])):{status:"cancelled",reason:"generation-not-current"},
    resource=>s.dispatch.finishCapability({...f,operationResource:resource}));
  f.publicPromise=f.operationResource.publicPromise;return emit({frame:f},params);
}
export async function WaitTerminal(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs);f.nativeTerminal=await resourceValue(f);return emit({frame:f},params);
}
export function ReadCurrent(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,api=s.api;
  f.result=syncCall(f,()=>{
    const current=s.sessions.get(f.input.chatId);
    return structuredClone({...f.nativeTerminal,
      executionId:record(current)&&record(current.execution)?current.execution.id:null,
      identity:{...identity(api),characterName:api.getCurrentCharacterName(),isGroup:Boolean(api.SillyTavern.groupId),scriptId:api.getScriptId(),lifecycleToken:s.lifecycleToken},
      latestMessage:api.getChatMessages(-1,{include_swipes:false})[0]??null});
  });
  return emit({frame:f},params);
}
