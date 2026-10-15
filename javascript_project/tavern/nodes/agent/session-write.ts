import {takeFrame,emit,route} from "../../base_lib/frames.ts";
import {record} from "../../base_lib/browser.ts";
import {deferred} from "../../base_lib/resources.ts";
export function CheckChat(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  if(typeof f.input.chatKey!=="string"||!f.input.chatKey)throw new TypeError("Agent 会话写入缺少 chatKey。");
  return emit({frame:f},params);
}
export function ChooseObservation(inputs:any,params:any):any {const f=takeFrame(inputs);return emit(route(f,f.input.startStoryObservation===true?"start":"keep"),params);}
export function SelectKeep(inputs:any,params:any):any {const f=takeFrame(inputs);f.observedSession=f.input.session;return emit({frame:f},params);}
export function SelectStart(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,api=s.api,value=f.input.session;
  const storyRequestId=`era-story-${(api.crypto??globalThis.crypto).randomUUID()}`;
  const execution=value.execution;
  const requestContext=record(execution)&&typeof execution.id==="string"&&typeof execution.trigger==="string"?{executionId:execution.id,trigger:execution.trigger,attemptIndex:0,intent:"initial"}:undefined;
  const chat=JSON.stringify([api.SillyTavern.characterId,api.SillyTavern.groupId,api.SillyTavern.getCurrentChatId()]);
  const host={model:api.SillyTavern.getChatCompletionModel(),preset:api.getLoadedPresetName(),provider:api.SillyTavern.chatCompletionSettings?.chat_completion_source??"未采集"};
  s.agentRecordView?.begin(storyRequestId,chat,"story",{injection:null},host,requestContext);s.agentRecordView?.armNative(storyRequestId);
  f.observedSession={...value,storyRequestId};return emit({frame:f},params);
}
export function BeginObservation(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;
  if(typeof f.input.nativeExecutionId==="string"){
    const identity={chatId:f.input.chatKey,executionId:f.input.nativeExecutionId},current=s.nativeCycle;
    if(!current||current.identity.chatId!==identity.chatId||current.identity.executionId!==identity.executionId){
      current?.resolve({status:"cancelled",reason:"superseded"});s.nativeCycle={...deferred(),identity:Object.freeze(identity)};
    }
  }
  s.observeAgentSession?.(f.observedSession,f.input.observationEventId);
  const stage=record(f.observedSession)?f.observedSession.pendingStage:null;
  if(record(stage)&&typeof stage.completionId==="string"&&!s.handoffs.has(stage.completionId))s.handoffs.set(stage.completionId,deferred());
  return emit({frame:f},params);
}
export function StoreSession(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,value=f.observedSession;
  s.sessions.set(f.input.chatKey,structuredClone(f.input.startStoryObservation===true?value:f.input.storageSession??value));
  if(record(value)&&typeof value.storyRequestId==="string"&&typeof value.story==="string")s.agentRecordView?.finish(value.storyRequestId,"responded",value.story);
  return emit({frame:f},params);
}
export function PublishSession(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.session.agentRecordView?.sessionChanged();f.result={status:"committed",chatKey:f.input.chatKey};return emit({frame:f},params);
}
