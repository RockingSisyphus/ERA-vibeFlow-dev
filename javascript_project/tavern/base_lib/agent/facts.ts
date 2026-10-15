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
