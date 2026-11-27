import {takeFrame,emit} from "../../base_lib/frames.ts";
import {currentTavern,saveTavernSettings} from "../../base_lib/browser.ts";
import {profileRecord,profileSummary,requireApiUrl} from "../../base_lib/agent/profiles.ts";
import {connectionStore,startResource,resourceValue} from "../../base_lib/resources.ts";
export function StartUpsert(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api,profiles=connectionStore(currentTavern(api));
  const existing=typeof f.input.sourceId==="string"?profileRecord(profiles[f.input.sourceId]):null;
  const secret=typeof f.input.keyProvider==="function"?String(f.input.keyProvider()):null;
  const profile={id:f.input.id??`profile-${(api.crypto??globalThis.crypto).randomUUID()}`,name:f.input.name,apiUrl:requireApiUrl(f.input.apiUrl),
    key:f.input.keyMode==="clear"?"":secret&&secret.length>0?secret:existing?.key??""};
  profiles[profile.id]=profile;f.result={status:f.input.status,profile:profileSummary(profile)};
  f.operationResource=startResource(f,signal=>saveTavernSettings(currentTavern(api),signal));f.publicPromise = f.operationResource.publicPromise;
  return emit({frame:f},params);
}
export function StartDelete(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api;delete connectionStore(currentTavern(api))[f.input.id];f.result={status:"deleted",id:f.input.id};
  f.operationResource=startResource(f,signal=>saveTavernSettings(currentTavern(api),signal));f.publicPromise = f.operationResource.publicPromise;
  return emit({frame:f},params);
}
export function StartClearKey(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api,profile={id:f.input.id,name:f.input.name,apiUrl:f.input.apiUrl,key:""};
  connectionStore(currentTavern(api))[profile.id]=profile;f.result={status:"cleared",profile:profileSummary(profile)};
  f.operationResource=startResource(f,signal=>saveTavernSettings(currentTavern(api),signal));f.publicPromise = f.operationResource.publicPromise;
  return emit({frame:f},params);
}
export async function AwaitSettings(inputs:any,params:any):Promise<any> {const f=takeFrame(inputs);await resourceValue(f);return emit({frame:f},params);}
