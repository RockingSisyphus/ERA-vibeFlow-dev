import {currentTavern, record} from "../browser.ts";
export function currentCharacterIndex(api:any):number|null {
  const context=currentTavern(api);
  if(typeof context.groupId==="string"&&context.groupId.length>0)return null;
  const index=Number(context.characterId);
  return Number.isSafeInteger(index)&&index>=0&&index<context.characters.length?index:null;
}
export function configuration(api:any):any {
  const context=currentTavern(api),index=currentCharacterIndex(api);
  if(index===null)return null;
  const character=context.characters[index];const data=record(character?.data)?character.data:null;
  const extensions=data!==null&&record(data.extensions)?data.extensions:null;
  return extensions!==null&&record(extensions.era_agent)?structuredClone(extensions.era_agent):null;
}
export function presetFacts(name:any,preset:any,loadedName:any):any {
  const settings=record(preset.settings)?preset.settings:{};
  return structuredClone({requestedName:name,loadedName:name==="in_use"?loadedName:null,
    prompts:(Array.isArray(preset.prompts)?preset.prompts.slice(0,256):[]).filter(record).map((prompt:any)=>({
      id:typeof prompt.id==="string"?prompt.id:null,enabled:prompt.enabled!==false,role:typeof prompt.role==="string"?prompt.role:null,content:typeof prompt.content==="string"?prompt.content:null,
    })),settings:Object.fromEntries(["max_completion_tokens","temperature","frequency_penalty","presence_penalty","top_p","top_k"].map(key=>[key,typeof settings[key]==="number"&&Number.isFinite(settings[key])?settings[key]:null]))});
}
export function modelNames(payload:any):string[] {
  if(!record(payload)||Object.hasOwn(payload,"error")||!Array.isArray(payload.data))throw new TypeError("酒馆模型状态响应缺少有效 data 数组。");
  const values=payload.data.map((item:any)=>{if(!record(item))return "";const value=item.id??item.name;return typeof value==="string"?value.trim():"";}).filter(Boolean);
  return [...new Set<string>(values)].sort().slice(0,2048);
}

/** Agent只接收当前消息正文、候选身份及ERA阶段标记；Helper的生成日期等页面元数据留在宿主。
 * 当前候选直接持有的ERA标记优先；原生swipe信息封套中的extra只作其未直接持有标记时的来源。
 */
export function agentMessage(value:any):any {
  if(!record(value))return null;
  const swipe=Number.isSafeInteger(value.swipe_id)?value.swipe_id:0;
  const info=value.extra??(Array.isArray(value.swipes_info)?value.swipes_info[swipe]:null);
  const marker=record(info?.era_agent)?info.era_agent:info?.extra?.era_agent;
  const reserved=Array.isArray(value.swipes)&&value.swipes.length>0&&swipe===value.swipes.length;
  return {message_id:value.message_id,name:value.name,role:value.role,is_hidden:value.is_hidden,swipe_id:swipe,
    message:reserved?"":typeof value.message==="string"?value.message:value.swipes?.[swipe]??"",
    extra:record(marker)?{era_agent:structuredClone(marker)}:{}};
}

/** 当前正文及附加资料来自Helper默认视图，完整视图只保留候选索引与预留位置事实。 */
export function readAgentMessages(api:any,range:string|number):any[] {
  const current=new Map(api.getChatMessages(range).map((message:any)=>[message.message_id,message]));
  return api.getChatMessages(range,{include_swipes:true}).map((message:any)=>
    agentMessage({...message,...(current.get(message.message_id) as any)}));
}
