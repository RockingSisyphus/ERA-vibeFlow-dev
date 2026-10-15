import {takeFrame,emit,route} from "../../base_lib/frames.ts";
import {currentTavern} from "../../base_lib/browser.ts";
import {connectionStore,completionResource,observeCompletion} from "../../base_lib/resources.ts";
import {profileId,profileRecord} from "../../base_lib/agent/profiles.ts";

function requestChat(api:any):string {return JSON.stringify([api.SillyTavern.characterId,api.SillyTavern.groupId,api.SillyTavern.getCurrentChatId()]);}
function observe(f:any,status:string,response?:string):void {
  f.session.observeAgentRequest?.(status,{id:f.requestId,chat:requestChat(f.session.api),stage:f.operation==="generate_story"?"story":String(f.input.stage??"auxiliary"),response});
}
export function CheckGenerate(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  if(typeof f.input.userInput!=="string"||!Array.isArray(f.input.orderedPrompts))throw new TypeError("Agent 模型请求缺少 userInput 或 orderedPrompts。");
  return emit({frame:f},params);
}
export function PrepareGenerate(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api;
  f.requestId=`${String(f.input.generationId??"era-request")}-${(api.crypto??globalThis.crypto).randomUUID()}`;
  f.session.observeAgentRequest?.("begin",{id:f.requestId,chat:requestChat(api),stage:String(f.input.stage??"auxiliary"),input:{userInput:f.input.userInput,orderedPrompts:f.input.orderedPrompts},requestContext:f.input.requestContext});
  return emit({frame:f},params);
}
export function PrepareStory(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api;
  f.requestId=`era-story-retry-${(api.crypto??globalThis.crypto).randomUUID()}`;
  f.storyInput=typeof f.input.userInput==="string"?f.input.userInput:"";f.storyInjection=typeof f.input.injection==="string"?f.input.injection:"";
  const host={model:api.SillyTavern.getChatCompletionModel(),preset:api.getLoadedPresetName(),provider:api.SillyTavern.chatCompletionSettings?.chat_completion_source??"未采集"};
  f.session.observeAgentRequest?.("begin",{id:f.requestId,chat:requestChat(api),stage:"story",input:{userInput:f.storyInput,injection:f.storyInjection},hostConfiguration:host,requestContext:f.input.requestContext});
  return emit({frame:f},params);
}
export function EnterAuxiliary(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session;
  s.auxiliaryGenerationDepth=(s.auxiliaryGenerationDepth??0)+1;s.modelLeases??=new Set();
  f.generationLease={owner:s,held:true};s.modelLeases.add(f.generationLease);return emit({frame:f},params);
}
/** 临时请求对象只停留在本次 Node 的原始 API 闭包，不把密钥写入跨入口帧。 */
function auxiliaryRequest(f:any):any {
  const api=f.session.api,binding=f.input.requestPolicy.binding,settings=f.input.requestPolicy.sampling;
  const id=profileId(binding.profileId);
  const profile=binding.kind==="custom-profile"?(id===null?null:profileRecord(connectionStore(currentTavern(api))[id])):null;
  if(binding.kind==="custom-profile"&&profile===null)throw new TypeError("ERA_AGENT_PROFILE_MISSING：本机连接方案不存在，需要重新绑定。");
  const model=binding.model??undefined;
  if(profile!==null&&!model)throw new TypeError("ERA_AGENT_MODEL_REQUIRED：自定义连接方案必须选择或填写模型。");
  f.modelRoute=profile===null?{kind:"tavern-current",model:model??api.SillyTavern.getChatCompletionModel()}:{kind:"custom-profile",profileId:profile.id,profileName:profile.name,model};
  const source=structuredClone(f.input.orderedPrompts);
  const prompts=f.input.resolvePresetMacros===true?source.map((p:any)=>typeof p==="string"?p:{...p,content:api.substitudeMacros(p.content)}):source;
  return {generation_id:f.requestId,user_input:f.input.userInput,ordered_prompts:prompts,should_stream:false,should_silence:true,
    custom_api:{...(profile?{apiurl:profile.apiUrl,...(profile.key?{key:profile.key}:{}),model,source:"openai"}:model?{model}:{}),
      max_tokens:settings.maxTokens,temperature:settings.temperature,frequency_penalty:settings.frequencyPenalty,presence_penalty:settings.presencePenalty,top_p:settings.topP,top_k:settings.topK}};
}
export function StartGenerate(inputs:any,params:any):any {
  const f=takeFrame(inputs),resource=completionResource(f);f.modelResource=resource;
  observeCompletion(resource,async()=>{const request=auxiliaryRequest(f);f.modelApiStarted=true;return await f.session.api.generateRaw(request);},outcome=>f.session.dispatch.modelComplete({...f,modelOutcome:outcome}));
  f.publicPromise=resource.promise;f.result=resource.promise;return emit({frame:f},params);
}
export function StartStory(inputs:any,params:any):any {
  const f=takeFrame(inputs),resource=completionResource(f);f.modelResource=resource;
  const config={generation_id:f.requestId,user_input:f.storyInput,should_stream:true,should_silence:false,
    ...(f.storyInjection.length>0?{injects:[{role:"system",content:f.storyInjection,position:"in_chat",depth:0,should_scan:false}]}:{})};
  observeCompletion(resource,async()=>await f.session.api.generate(config),outcome=>f.session.dispatch.modelComplete({...f,modelOutcome:outcome}));
  f.publicPromise=resource.promise;f.result=resource.promise;return emit({frame:f},params);
}
/** 真实终态由机械回调进入本同步 Node；计数变更从不在 Promise 回调中执行。 */
export function ReleaseAuxiliary(inputs:any,params:any):any {
  const f=takeFrame(inputs),lease=f.generationLease;
  if(lease?.owner!==f.session)throw new TypeError("辅助生成租约不属于当前实例。");
  if(lease.held){lease.held=false;f.session.auxiliaryGenerationDepth=Math.max(0,(f.session.auxiliaryGenerationDepth??0)-1);f.session.modelLeases.delete(lease);}
  return emit({frame:f},params);
}
export function ReadModelOutcome(inputs:any,params:any):any {
  const f=takeFrame(inputs),o=f.modelOutcome;
  if(!o||f.modelResource?.owner!==f.session)throw new TypeError("缺少本次真实模型终态。");
  if(f.operation==="generate"&&o.status==="rejected"&&f.modelApiStarted&&!f.modelResource.signal.aborted) {
    const message=f.modelRoute?.kind==="custom-profile"?`ERA_AGENT_AUXILIARY_REQUEST_FAILED：本机方案“${f.modelRoute.profileName}”请求失败。`:"ERA_AGENT_AUXILIARY_REQUEST_FAILED：酒馆当前连接请求失败。";
    f.modelOutcome={...o,error:new TypeError(message,{cause:o.error})};
  }
  const responded=o.status==="fulfilled"&&(f.operation==="generate_story"||!f.modelResource.signal.aborted&&typeof o.value==="string");
  observe(f,responded?"responded":"failed",responded&&typeof o.value==="string"?o.value:undefined);return emit({frame:f},params);
}
export function CheckReleased(inputs:any,params:any):any {
  const f=takeFrame(inputs);if(f.generationLease?.held)throw new Error("真实模型终态未经过同步保护归还。");return emit({frame:f},params);
}
export function ClassifyModel(inputs:any,params:any):any {
  const f=takeFrame(inputs),o=f.modelOutcome;
  return emit(route(f,f.modelResource.signal.aborted?"cancelled":o.status==="rejected"||typeof o.value!=="string"?"failed":"text"),params);
}
export function CancelledModel(inputs:any,params:any):never {const f=takeFrame(inputs);throw f.modelResource.signal.reason;}
export function FailedGenerate(inputs:any,params:any):any {
  const f=takeFrame(inputs),error=f.modelOutcome.error;
  const raw=error instanceof Error?error.message:"",code=raw.match(/\bERA_AGENT_[A-Z0-9_]+\b/)?.[0]??"ERA_AGENT_AUXILIARY_REQUEST_FAILED";
  const message=raw.includes(code)?raw.slice(0,512):"ERA_AGENT_AUXILIARY_REQUEST_FAILED：辅助模型请求失败。";
  f.result={status:"failed",diagnostic:{code,message},requestId:f.requestId};return emit({frame:f},params);
}
export function FailedStory(inputs:any,params:any):never {const f=takeFrame(inputs);throw f.modelOutcome.error??new TypeError("故事重试必须返回正文文本。");}
export function TextGenerate(inputs:any,params:any):any {const f=takeFrame(inputs);f.result={generationId:f.requestId,requestId:f.requestId,response:f.modelOutcome.value,route:f.modelRoute};return emit({frame:f},params);}
export function TextStory(inputs:any,params:any):any {const f=takeFrame(inputs);f.result={response:f.modelOutcome.value,requestId:f.requestId};return emit({frame:f},params);}
