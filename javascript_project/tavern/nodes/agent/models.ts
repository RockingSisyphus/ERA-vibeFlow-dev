import {takeFrame,emit} from "../../base_lib/frames.ts";
import {currentTavern,tavernEndpoint} from "../../base_lib/browser.ts";
import {profileId,profileRecord,profileSummary,requireApiUrl} from "../../base_lib/agent/profiles.ts";
import {modelNames} from "../../base_lib/agent/facts.ts";
import {connectionStore,startResource,resourceValue,rawCall} from "../../base_lib/resources.ts";
function modelFailure(f:any,error:any):never {
  if(f.session.lifecycle.signal.aborted||f.session.operational.signal.aborted||f.options?.signal?.aborted)throw error;
  const message=f.operation==="list_connection_models_draft"?"ERA_AGENT_MODEL_LIST_FAILED：无法从尚未保存的连接草稿加载模型列表。":`ERA_AGENT_MODEL_LIST_FAILED：无法从“${f.profileSummary.name}”加载模型列表。`;
  throw new TypeError(message,{cause:error});
}
/** 密钥只在本次原始请求的局部闭包中使用，跨入口只保留摘要和等待句柄。 */
export function StartModels(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api;const id=profileId(f.input.id);
  const profile=id===null?null:profileRecord(connectionStore(currentTavern(api))[id]);
  if(profile===null)throw new TypeError("ERA_AGENT_PROFILE_MISSING：本机连接方案不存在，需要重新绑定。");
  f.profileSummary=profileSummary(profile);
  f.operationResource=startResource(f,signal=>api.fetch(tavernEndpoint(api,"/api/backends/chat-completions/status"),{
    method:"POST",headers:currentTavern(api).getRequestHeaders(),cache:"no-cache",signal,
    body:JSON.stringify({reverse_proxy:profile.apiUrl,proxy_password:profile.key,chat_completion_source:"openai"}),
  }));f.publicPromise = f.operationResource.publicPromise;
  return emit({frame:f},params);
}
export function StartDraftModels(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api;
  try {
    const url=requireApiUrl(f.input.apiUrl),key=typeof f.input.keyProvider==="function"?String(f.input.keyProvider()):"";
    f.operationResource=startResource(f,signal=>api.fetch(tavernEndpoint(api,"/api/backends/chat-completions/status"),{
      method:"POST",headers:currentTavern(api).getRequestHeaders(),cache:"no-cache",signal,
      body:JSON.stringify({reverse_proxy:url,proxy_password:key,chat_completion_source:"openai"}),
    }));f.publicPromise = f.operationResource.publicPromise;
  return emit({frame:f},params);
  }catch(error){return modelFailure(f,error);}
}
export async function AwaitStatus(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs);
  try{f.response=await resourceValue(f);return emit({frame:f},params);}catch(error){return modelFailure(f,error);}
}
export function CheckResponse(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  if(!f.response.ok)return modelFailure(f,new TypeError(`酒馆模型状态请求失败（HTTP ${f.response.status}）。`));
  return emit({frame:f},params);
}
export async function ReadJson(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs);try{f.modelPayload=await rawCall(f,()=>f.response.json());return emit({frame:f},params);}catch(error){return modelFailure(f,error);}
}
export function ProjectModels(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  try{const models=modelNames(f.modelPayload);f.result=f.operation==="list_connection_models_draft"?{models}:{profile:f.profileSummary,models};return emit({frame:f},params);}
  catch(error){return modelFailure(f,error);}
}
