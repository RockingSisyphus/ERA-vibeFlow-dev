import {takeFrame, emit, assertRunning} from "../../base_lib/frames.ts";
import {record} from "../../base_lib/browser.ts";
import {runtimeIdentity, currentIdentity, workingKey} from "../../base_lib/sidecar/facts.ts";
import {assertCurrentMessageBasis, assertExpectedSidecarPointer, assertMessageWriteTargets} from "../../base_lib/messages/target.ts";
import {snapshotFacts} from "../../base_lib/sidecar/facts.ts";
import {readProjectedMessages} from "../../base_lib/messages/projection.ts";

/** 内存暂存沿用Service声明的原生候选；同一生成周期新增正文不改写计算时的基线。 */
function workingOperationBasis(api: any, session: any, input: any): any {
  if (Object.hasOwn(input,"expectedSourceBasis")) return input.expectedSourceBasis;
  const basis=input.sourceBasis, pending=input.nativeCandidate?.messages;
  if (!Array.isArray(basis?.messages)||!Array.isArray(pending)||!pending.length) return basis;
  const current=new Map(readProjectedMessages(api,session).map(message=>[message.messageId,message]));
  const retained=new Map<number,any>(pending.map((item:any)=>[item.source.messageId,item.source] as const));
  return {...basis,messages:basis.messages.map((source:any)=>{
    const owner=retained.get(source.messageId),now=current.get(source.messageId),generation=source.candidate?.generation;
    if (!owner||!now||generation==null||
        (source.candidate.phase!=='generating'&&source.candidate.exists!==false)||
        owner.role!==source.role||(owner.swipeIndex??0)!==(source.swipeIndex??0)||
        owner.candidate?.generation!==generation||!source.activeText.startsWith(owner.activeText)||
        now.role!==source.role||(now.swipeIndex??0)!==(source.swipeIndex??0)||
        now.candidate.generation!==generation||!['generating','completed'].includes(now.candidate.phase)||
        !now.activeText.startsWith(source.activeText)) return source;
    // 只核对本次内存操作。原sourceBasis及待写前缀保留，真实正文/文件写入仍逐字核对。
    return {...source,activeText:now.activeText};
  })};
}
export function ReadWorking(inputs: any, params: any): any {
  const f=takeFrame(inputs);f.session.workingByChat??=new Map();const working=f.session.workingByChat.get(workingKey(currentIdentity(f.session.api)));
  f.result={working:working?structuredClone(working):null};return emit({frame:f},params);
}
export function CheckWorking(inputs: any, params: any): any {
  const f=takeFrame(inputs),api=f.session.api;assertRunning(f.session);f.options?.signal?.throwIfAborted();
  if(!record(f.input.record))throw new TypeError("工作状态缺少record。");
  assertExpectedSidecarPointer(api,{expectedSidecarId:f.input.record.sidecarId});
  // 恢复记录保留其原来源；操作依据则必须是触发本次恢复的当前候选。
  const expectedBasis=workingOperationBasis(api,f.session,f.input);
  if(Object.hasOwn(f.input,"expectedSourceBasis")||expectedBasis!=null)assertCurrentMessageBasis(api, expectedBasis, f.session);
  const actual=runtimeIdentity(currentIdentity(api));assertMessageWriteTargets(runtimeIdentity(f.input.record.owner),actual,[],()=>null);
  f.session.workingByChat??=new Map();f.workingKey=workingKey(actual);const current=f.session.workingByChat.get(f.workingKey);
  if(f.input.expectedVersion!==undefined&&f.input.expectedVersion!==(current?.version??0))throw new Error("ERA_WORKING_STATE_CHANGED");
  f.working={identity:actual,version:(current?.version??0)+1,record:f.input.record,work:record(f.input.work)?f.input.work:null,
    sourceBasis:record(f.input.sourceBasis)?f.input.sourceBasis:null,dirty:f.input.dirty===true,stage:record(f.input.stage)?f.input.stage:null,
    appliedMessageWrites:f.input.dirty!==true?[]:(f.input.appliedMessageWrites??current?.appliedMessageWrites??[]),
    nativeCandidate:Object.hasOwn(f.input,"nativeCandidate")?f.input.nativeCandidate:(current?.nativeCandidate??null)};
  return emit({frame:f},params);
}
export function StoreWorking(inputs: any, params: any): any {
  const f=takeFrame(inputs);
  for(const [key,previous] of f.session.workingByChat)if(key!==f.workingKey&&!previous.dirty&&!previous.nativeCandidate)f.session.workingByChat.delete(key);
  f.session.workingByChat.set(f.workingKey,structuredClone(f.working));f.session.storeWorkingState?.(f.working);return emit({frame:f},params);
}
export function PublishWorking(inputs: any, params: any): any {
  const f=takeFrame(inputs);
  if (!f.working.dirty || f.input.publishApplied === true) {
    const snapshot=snapshotFacts({sidecarId:f.input.record.sidecarId,snapshot:f.input.record});
    f.session.activeSnapshot=structuredClone(snapshot);
    f.session.publishSnapshot?.(snapshot,!f.working.dirty && f.input.notifySubscribers===true);
  }
  f.result={working:f.working};return emit({frame:f},params);
}
