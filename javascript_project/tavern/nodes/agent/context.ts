import {takeFrame, emit} from "../../base_lib/frames.ts";
import {identity, currentTavern} from "../../base_lib/browser.ts";
import {configuration,currentCharacterIndex,presetFacts} from "../../base_lib/agent/facts.ts";
import {profileRecord,profileSummary} from "../../base_lib/agent/profiles.ts";
import {connectionStore,startResource,resourceValue,syncCall} from "../../base_lib/resources.ts";
function summaries(api:any):any[] {return Object.values(connectionStore(currentTavern(api))).map(profileRecord).filter(Boolean).sort((a:any,b:any)=>a.name.localeCompare(b.name,"zh-CN")).map(profileSummary);}
export function ReadContext(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api;const actual=identity(api),snapshot=f.session.activeSnapshot??null;
  f.result=syncCall(f,()=>structuredClone({identity:actual,groupChat:typeof actual.groupId==="string"&&actual.groupId.length>0,
    configuration:configuration(api),session:typeof actual.chatId==="string"&&actual.chatId.length>0?(f.session.sessions.get(actual.chatId)??null):null,
    latestMessage:api.getChatMessages(-1,{include_swipes:false})[0]??null,messages:api.getChatMessages("0-{{lastMessageId}}",{include_swipes:false}).slice(-64),
    state:snapshot===null?null:{revision:snapshot.revision,statData:snapshot.statData,statFunc:snapshot.statFunc,eraMeta:snapshot.eraMeta}}));
  return emit({frame:f},params);
}
export function StartConfiguration(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api;
  if(f.input.configuration===null||typeof f.input.configuration!=="object"||Array.isArray(f.input.configuration))throw new TypeError("Agent 配置写入缺少 configuration。");
  const c=structuredClone(f.input.configuration),tavern=currentTavern(api);
  if(typeof tavern.groupId==="string"&&tavern.groupId.length>0)throw new TypeError("群聊不支持写入 ERA 多阶段生成配置。");
  const index=currentCharacterIndex(api);if(index===null)throw new TypeError("当前没有可写入 Agent 配置的角色卡。");
  f.result={status:"committed",configuration:c};f.operationResource=startResource(f,()=>currentTavern(api).writeExtensionField(index,"era_agent",c), resource => f.session.dispatch.finishCapability({...f, operationResource: resource}));f.publicPromise = f.operationResource.publicPromise;
  return emit({frame:f},params);
}
export async function AwaitConfiguration(inputs:any,params:any):Promise<any> {const f=takeFrame(inputs);await resourceValue(f);return emit({frame:f},params);}
export function CapturePreset(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api,tavern=currentTavern(api);
  if(typeof tavern.groupId==="string"&&tavern.groupId.length>0)throw new TypeError("群聊不支持 ERA 多阶段生成预设。");
  const preset=api.getPreset(f.input.name);f.result=presetFacts(f.input.name,preset,f.input.name==="in_use"?api.getLoadedPresetName():null);return emit({frame:f},params);
}
export function ReadSources(inputs:any,params:any):any {const f=takeFrame(inputs),api=f.session.api;f.result=structuredClone({presetNames:api.getPresetNames(),currentPresetName:api.getLoadedPresetName(),connectionProfiles:summaries(api)});return emit({frame:f},params);}
export function ReadConnectionState(inputs:any,params:any):any {
  const f=takeFrame(inputs),profiles=connectionStore(currentTavern(f.session.api)),id=typeof f.input.id==="string"?f.input.id:null,profile=id===null?null:profileRecord(profiles[id]);
  f.result={entryCount:Object.keys(profiles).length,entryExists:id!==null&&Object.hasOwn(profiles,id),profile:profile===null?null:profileSummary(profile)};return emit({frame:f},params);
}
