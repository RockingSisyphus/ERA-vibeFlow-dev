import {takeFrame,emit} from "../../base_lib/frames.ts";
import {record} from "../../base_lib/browser.ts";
import {startResource,resourceValue} from "../../base_lib/resources.ts";

export function ReadBinding(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,previous=s.sessions.get(f.input.chatKey);
  f.result=structuredClone({active:s.nativeGenerationActive===true,previous:record(previous)?{
    execution:record(previous.execution)?{id:previous.execution.id}:previous.execution,
    storyRequestId:previous.storyRequestId,nativeGeneration:previous.nativeGeneration,
  }:null});return emit({frame:f},params);
}
export function ClearSession(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,key=typeof f.input.chatKey==="string"?f.input.chatKey:null;
  if(key===null)s.sessions.clear();else s.sessions.delete(key);
  s.agentRecordView?.stopNative();s.agentRecordView?.sessionChanged();
  f.result={status:"cleared",chatKey:key};return emit({frame:f},params);
}
export function InjectOnce(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,api=s.api;
  if(typeof f.input.content!=="string"||typeof f.input.id!=="string")throw new TypeError("Agent 一次性注入缺少 id 或 content。");
  const key=api.SillyTavern.getCurrentChatId()??"",session=s.sessions.get(key);
  const id=record(session)&&typeof session.storyRequestId==="string"?session.storyRequestId:`era-story-${(api.crypto??globalThis.crypto).randomUUID()}`;
  const chat=JSON.stringify([api.SillyTavern.characterId,api.SillyTavern.groupId,api.SillyTavern.getCurrentChatId()]);
  const host={model:api.SillyTavern.getChatCompletionModel(),preset:api.getLoadedPresetName(),provider:api.SillyTavern.chatCompletionSettings?.chat_completion_source??"未采集"};
  s.agentRecordView?.begin(id,chat,"story",{injection:f.input.content},host,s.agentRecordView?.get(chat,id)?.requestContext);
  s.agentRecordView?.armNative(id);
  if(record(session))s.sessions.set(key,{...session,storyRequestId:id});
  api.injectPrompts([{id:f.input.id,position:"in_chat",depth:0,role:"system",content:f.input.content,should_scan:false}],{once:true});
  f.result={status:"injected",id:f.input.id};return emit({frame:f},params);
}
export function StartErrorMessage(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  if(typeof f.input.message!=="string")throw new TypeError("Agent 错误消息缺少 message。");
  f.operationResource=startResource(f,()=>f.session.api.createChatMessages([{role:"system",message:f.input.message,extra:{era_agent:{status:"planning-failed",swipeLocked:true}}}],{insert_before:"end",refresh:"affected"}),resource=>f.session.dispatch.finishCapability({...f,operationResource:resource}));
  f.publicPromise=f.operationResource.publicPromise;return emit({frame:f},params);
}
export async function AwaitErrorMessage(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs);await resourceValue(f);f.result={status:"created"};return emit({frame:f},params);
}
