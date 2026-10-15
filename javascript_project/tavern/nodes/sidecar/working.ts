import {takeFrame, emit, assertRunning} from "../../base_lib/frames.ts";
import {record} from "../../base_lib/browser.ts";
import {runtimeIdentity, currentIdentity, workingKey} from "../../base_lib/sidecar/facts.ts";
import {assertCurrentMessageBasis, assertExpectedSidecarPointer, assertMessageWriteTargets} from "../../base_lib/messages/target.ts";
import {snapshotFacts} from "../../base_lib/sidecar/facts.ts";
export function ReadWorking(inputs: any, params: any): any {
  const f=takeFrame(inputs);f.session.workingByChat??=new Map();const working=f.session.workingByChat.get(workingKey(currentIdentity(f.session.api)));
  f.result={working:working?structuredClone(working):null};return emit({frame:f},params);
}
export function CheckWorking(inputs: any, params: any): any {
  const f=takeFrame(inputs),api=f.session.api;assertRunning(f.session);f.options?.signal?.throwIfAborted();
  if(!record(f.input.record))throw new TypeError("工作状态缺少record。");
  assertExpectedSidecarPointer(api,{expectedSidecarId:f.input.record.sidecarId});
  if(f.input.sourceBasis!=null)assertCurrentMessageBasis(api,f.input.sourceBasis);
  const actual=runtimeIdentity(currentIdentity(api));assertMessageWriteTargets(runtimeIdentity(f.input.record.owner),actual,[],()=>null);
  f.session.workingByChat??=new Map();f.workingKey=workingKey(actual);const current=f.session.workingByChat.get(f.workingKey);
  if(f.input.expectedVersion!==undefined&&f.input.expectedVersion!==(current?.version??0))throw new Error("ERA_WORKING_STATE_CHANGED");
  f.working={identity:actual,version:(current?.version??0)+1,record:f.input.record,work:record(f.input.work)?f.input.work:null,
    sourceBasis:record(f.input.sourceBasis)?f.input.sourceBasis:null,dirty:f.input.dirty===true,stage:record(f.input.stage)?f.input.stage:null};
  return emit({frame:f},params);
}
export function StoreWorking(inputs: any, params: any): any {
  const f=takeFrame(inputs);
  for(const [key,previous] of f.session.workingByChat)if(key!==f.workingKey&&!previous.dirty)f.session.workingByChat.delete(key);
  f.session.workingByChat.set(f.workingKey,structuredClone(f.working));f.session.storeWorkingState?.(f.working);return emit({frame:f},params);
}
export function PublishWorking(inputs: any, params: any): any {
  const f=takeFrame(inputs),snapshot=snapshotFacts({sidecarId:f.input.record.sidecarId,snapshot:f.input.record});
  f.session.activeSnapshot=structuredClone(snapshot);f.session.publishSnapshot?.(snapshot,f.input.notifySubscribers===true);
  f.result={working:f.working};return emit({frame:f},params);
}
