import {takeFrame,emit} from "../../base_lib/frames.ts";
import {currentTavern,tavernEndpoint,record} from "../../base_lib/browser.ts";
import {startResource,resourceValue} from "../../base_lib/resources.ts";
export function StartExtension(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api,t=currentTavern(api),avatar=String(f.input.characterId),index=t.characters.findIndex((c:any)=>c.avatar===avatar);
  if(index<0)throw new Error(f.operation==="patch_external_statusbar"?"外置状态栏目标角色卡已不存在":"目标角色卡已不存在");
  f.extensionTavern=t;f.extensionCharacter=t.characters[index];f.extensionIndex=index;
  if(f.operation==="patch_single_floor"){f.extensionKey="era_single_floor";f.extensionValue={version:1,enabled:f.input.enabled};}
  else{f.extensionKey="era_external_statusbar";const old=f.extensionCharacter.data?.extensions?.era_external_statusbar;const c=record(old)?old:{};f.extensionValue={version:1,enabled:c.enabled===true,html:typeof c.html==="string"?c.html:"",...f.input.patch};f.extensionValue.version=1;}
  f.extensionJson=f.extensionCharacter.json_data?JSON.parse(f.extensionCharacter.json_data):undefined;
  if(f.extensionJson){f.extensionJson.data??={};f.extensionJson.data.extensions??={};f.extensionJson.data.extensions[f.extensionKey]=f.extensionValue;}
  f.operationResource=startResource(f,signal=>api.fetch(tavernEndpoint(api,"/api/characters/merge-attributes"),{method:"POST",headers:t.getRequestHeaders(),signal,body:JSON.stringify({avatar:f.extensionCharacter.avatar,data:{extensions:{[f.extensionKey]:f.extensionValue}}})}),r=>f.session.dispatch.finishCapability({...f,operationResource:r}));
  f.publicPromise=f.operationResource.publicPromise;return emit({frame:f},params);
}
export async function AwaitExtension(inputs:any,params:any):Promise<any> {const f=takeFrame(inputs);f.response=await resourceValue(f);return emit({frame:f},params);}
export function CheckResponse(inputs:any,params:any):any {const f=takeFrame(inputs);if(!f.response.ok)throw new Error(`角色卡设置保存失败：HTTP ${f.response.status}`);return emit({frame:f},params);}
export function PublishExtension(inputs:any,params:any):any {
  const f=takeFrame(inputs),c=f.extensionCharacter;c.data.extensions??={};c.data.extensions[f.extensionKey]=f.extensionValue;
  if(f.extensionJson){c.json_data=JSON.stringify(f.extensionJson);if(Number(f.extensionTavern.characterId)===f.extensionIndex){const field=f.session.api.window?.top?.document?.querySelector("#character_json_data");if(field)field.value=c.json_data;}}
  if(f.operation==="patch_single_floor")f.session.refreshSingleFloor?.();else f.session.refreshExternalStatusbar?.();
  f.result={status:"updated"};return emit({frame:f},params);
}
