import {takeFrame, emit, route} from "../../base_lib/frames.ts";
import {record, tavernEndpoint} from "../../base_lib/browser.ts";
import {sidecarId, fileName, filePath} from "../../base_lib/sidecar/facts.ts";
import {startResource, resourceValue, rawCall} from "../../base_lib/resources.ts";
import {assertCurrentMessageBasis, assertExpectedSidecarPointer} from "../../base_lib/messages/target.ts";
function headers(api:any):any {return typeof api.SillyTavern.getRequestHeaders==="function"?api.SillyTavern.getRequestHeaders():{"Content-Type":"application/json"};}
export function StartRead(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api;f.sidecarId=sidecarId(f.input.sidecarId);
  f.operationResource=startResource(f,signal=>api.fetch(tavernEndpoint(api,filePath(f.sidecarId)),{headers:headers(api),signal}));f.publicPromise = f.operationResource.publicPromise;
  return emit({frame:f},params);
}
export async function AwaitRead(inputs:any,params:any):Promise<any> {const f=takeFrame(inputs);f.response=await resourceValue(f);return emit({frame:f},params);}
export function ChooseResponse(inputs:any,params:any):any {const f=takeFrame(inputs);return emit(route(f,f.response.status===404?"missing":f.response.ok?"found":"failed"),params);}
export function Missing(inputs:any,params:any):any {const f=takeFrame(inputs);f.result={status:"missing",sidecarId:f.sidecarId};return emit({frame:f},params);}
export function Failed(inputs:any,params:any):never {const f=takeFrame(inputs);throw new TypeError(`ERA Sidecar 文件读取失败：${f.response.status}`);}
export async function ReadText(inputs:any,params:any):Promise<any> {const f=takeFrame(inputs);f.fileText=await rawCall(f,()=>f.response.text());return emit({frame:f},params);}
export function ChooseJson(inputs:any,params:any):any {
  const f=takeFrame(inputs);
  try{f.fileRecord=structuredClone(JSON.parse(f.fileText));return emit(route(f,"found"),params);}
  catch{return emit(route(f,"invalid"),params);}
}
export function Found(inputs:any,params:any):any {const f=takeFrame(inputs);f.result={status:"found",sidecarId:f.sidecarId,record:f.fileRecord};return emit({frame:f},params);}
export function Invalid(inputs:any,params:any):any {const f=takeFrame(inputs);f.result={status:"invalid",sidecarId:f.sidecarId};return emit({frame:f},params);}
export function CheckRecord(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.sidecarId=sidecarId(f.input.sidecarId);
  if(!record(f.input.record))throw new TypeError("ERA Sidecar 文件写入缺少 record。");
  f.fileRecord=structuredClone(f.input.record);return emit({frame:f},params);
}
export function CheckTarget(inputs:any,params:any):any {
  const f=takeFrame(inputs);if(f.input.sourceBasis!==undefined)assertCurrentMessageBasis(f.session.api, f.input.sourceBasis, f.session);
  assertExpectedSidecarPointer(f.session.api,f.input);return emit({frame:f},params);
}
export function EncodeFile(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.fileUpload={name:fileName(f.sidecarId),data:globalThis.btoa(unescape(encodeURIComponent(JSON.stringify(f.fileRecord))))};return emit({frame:f},params);
}
export function StartWrite(inputs:any,params:any):any {
  const f=takeFrame(inputs),api=f.session.api;
  if(f.input.sourceBasis!==undefined)assertCurrentMessageBasis(api, f.input.sourceBasis, f.session);assertExpectedSidecarPointer(api,f.input);
  f.operationResource=startResource(f,signal=>api.fetch(tavernEndpoint(api,"/api/files/upload"),{method:"POST",headers:headers(api),signal,body:JSON.stringify(f.fileUpload)}));f.publicPromise = f.operationResource.publicPromise;
  return emit({frame:f},params);
}
export async function AwaitWrite(inputs:any,params:any):Promise<any> {
  const f=takeFrame(inputs),response=await resourceValue(f);
  if(!response.ok)throw new TypeError(`ERA Sidecar 文件写入失败：${response.status}`);
  f.result={status:"committed",sidecarId:f.sidecarId,url:filePath(f.sidecarId)};return emit({frame:f},params);
}
