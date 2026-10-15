import {takeFrame, emit, route} from "../../base_lib/frames.ts";
import {syncCall} from "../../base_lib/resources.ts";
import {record} from "../../base_lib/browser.ts";
import {currentIdentity, runtimeIdentity, sidecarId, workingKey, snapshotFacts, sameIdentity} from "../../base_lib/sidecar/facts.ts";
import {assertCurrentMessageBasis, assertExpectedSidecarPointer, assertMessageWriteTargets} from "../../base_lib/messages/target.ts";
export function ReadCurrent(inputs: any, params: any): any {
  const f = takeFrame(inputs);
  f.result = syncCall(f, () => {
    const variables = structuredClone(f.session.api.getVariables({type:"chat"}));
    return {identity: currentIdentity(f.session.api), meta: record(variables.ERAMetaData) ? structuredClone(variables.ERAMetaData) : null,
      stat: record(variables) && Object.hasOwn(variables,"stat_data") ? structuredClone(variables.stat_data) : null};
  });
  return emit({frame:f},params);
}
export function CheckPointer(inputs: any, params: any): any {
  const f=takeFrame(inputs),api=f.session.api; f.sidecarId=sidecarId(f.input.sidecarId);
  if(f.input.sourceBasis!==undefined)assertCurrentMessageBasis(api,f.input.sourceBasis);
  assertExpectedSidecarPointer(api,f.input);
  if(record(f.input.snapshot))assertMessageWriteTargets(runtimeIdentity(f.input.snapshot.owner),runtimeIdentity(currentIdentity(api)),[],()=>null);
  return emit({frame:f},params);
}
export function WritePointer(inputs: any, params: any): any {
  const f=takeFrame(inputs),api=f.session.api,existing=api.getVariables({type:"chat"});
  if(!record(existing.ERAMetaData)||existing.ERAMetaData.SidecarId!==f.sidecarId||Object.hasOwn(existing,"stat_data"))
    syncCall(f,()=>api.updateVariablesWith((current:any)=>{delete current.stat_data;current.ERAMetaData={SidecarId:f.sidecarId};return current;},{type:"chat"}));
  return emit({frame:f},params);
}
export function CheckWorkingVersion(inputs: any, params: any): any {
  const f=takeFrame(inputs),key=workingKey(currentIdentity(f.session.api));
  f.session.workingByChat??=new Map();const working=f.session.workingByChat.get(key);
  return emit(route(f,record(f.input.snapshot)&&(f.input.workingVersion===undefined||working?.version===f.input.workingVersion)?"publish":"skip"),params);
}
export function PublishSnapshot(inputs: any, params: any): any {
  const f=takeFrame(inputs),snapshot=snapshotFacts(f.input);
  const published=sameIdentity(snapshot.identity,currentIdentity(f.session.api));
  if(published){f.session.activeSnapshot=structuredClone(snapshot);f.session.publishSnapshot?.(snapshot,f.input.notifySubscribers!==false);}
  f.result={status:published?"published":"ignored",sidecarId:snapshot.sidecarId};
  return emit({frame:f},params);
}
export function ReadBack(inputs: any, params: any): any {
  const f=takeFrame(inputs);f.result={status:"committed",sidecarId:f.sidecarId,variables:structuredClone(f.session.api.getVariables({type:"chat"}))};return emit({frame:f},params);
}
