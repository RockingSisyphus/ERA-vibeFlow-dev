import {takeFrame,emit} from "../../base_lib/frames.ts";
import {currentTavern,tavernEndpoint} from "../../base_lib/browser.ts";
import {startResource,resourceValue,rawCall} from "../../base_lib/resources.ts";
export function ReadRefreshContext(inputs:any,params:any):any {
  const f=takeFrame(inputs),t=currentTavern(f.session.api),m=t.chat[0];
  f.result={group:Boolean(t.groupId),tainted:t.chatMetadata.tainted===true,length:t.chat.length,
    first:m?{is_user:Boolean(m.is_user),is_system:Boolean(m.is_system),swipe_id:m.swipe_id??0,mes:m.mes,primary:Array.isArray(m.swipes)?m.swipes[0]:m.mes}:null};
  return emit({frame:f},params);
}
export function StartRead(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api;f.characterName=api.getCurrentCharacterName();f.greetingMissing=Boolean(api.SillyTavern.groupId||!f.characterName);
  f.operationResource=startResource(f,()=>f.greetingMissing?null:api.getCharacter(f.characterName));
  f.publicPromise=f.operationResource.publicPromise;return emit({frame:f},params);
}
export async function ReadGreeting(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs),character=await resourceValue(f);
  if(f.greetingMissing)f.result={status:"missing",firstMessage:null};
  else{const t=currentTavern(f.session.api),c=t.characters[Number(t.characterId)];f.result={status:"ready",characterId:c.avatar,externalStatusbar:c.data?.extensions?.era_external_statusbar??null,firstMessage:typeof character.first_messages[0]==="string"?character.first_messages[0]:""};}
  return emit({frame:f},params);
}
export function StartWrite(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api;
  if(typeof f.input.expected!=="string"||typeof f.input.next!=="string")throw new TypeError("主开场白写入请求缺少 expected 或 next。");
  f.characterName=api.getCurrentCharacterName();
  if(api.SillyTavern.groupId||!f.characterName)throw new Error("ERA_CHARACTER_GREETING_MISSING: 当前未打开可写入的单角色角色卡。");
  f.operationResource=startResource(f,()=>api.getCharacter(f.characterName));
  f.publicPromise=f.operationResource.publicPromise;return emit({frame:f},params);
}
export async function AwaitCharacter(inputs:any,params:any):Promise<any> {const f=takeFrame(inputs);f.readCharacter=await resourceValue(f);return emit({frame:f},params);}
export function CheckExpected(inputs:any,params:any):any {
  const f=takeFrame(inputs),observed=typeof f.readCharacter.first_messages[0]==="string"?f.readCharacter.first_messages[0]:"";
  if(observed!==f.input.expected)throw new Error("ERA_CHARACTER_GREETING_STALE: 主开场白已在初始化期间改变。");return emit({frame:f},params);
}
export async function PersistGreeting(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs),api=f.session.api,t=currentTavern(api),index=Number(t.characterId),c=t.characters[index];
  if(!Number.isSafeInteger(index)||index<0||typeof c?.avatar!=="string")throw new Error("ERA_CHARACTER_GREETING_MISSING: 无法解析当前角色卡。");
  f.greetingCharacter=c;
  f.response=await rawCall(f,()=>api.fetch(tavernEndpoint(api,"/api/characters/merge-attributes"),{method:"POST",headers:t.getRequestHeaders(),body:JSON.stringify({avatar:c.avatar,first_mes:f.input.next,data:{first_mes:f.input.next}})}));
  return emit({frame:f},params);
}
export async function CheckResponse(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs);
  if(!f.response.ok)throw new Error(`ERA_CHARACTER_GREETING_WRITE_FAILED: ${f.response.status} ${await f.response.text()}`);
  return emit({frame:f},params);
}
export function PublishGreeting(inputs:any,params:any):any {
  const f=takeFrame(inputs),c=f.greetingCharacter,next=f.input.next;c.first_mes=next;if(c.data)c.data.first_mes=next;
  if(typeof c.json_data==="string"){const data=JSON.parse(c.json_data);data.first_mes=next;if(data.data)data.data.first_mes=next;c.json_data=JSON.stringify(data);}
  const field=f.session.api.window?.top?.document?.querySelector("#firstmessage_textarea");if(field)field.value=next;
  f.result={status:"updated",firstMessage:next};return emit({frame:f},params);
}
