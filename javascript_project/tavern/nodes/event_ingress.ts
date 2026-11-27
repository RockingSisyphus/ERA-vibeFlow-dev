import {takeFrame,emit,route} from "../base_lib/frames.ts";
import {assertCurrentMessageBasis} from "../base_lib/messages/target.ts";
import {projectMessage, candidateFactKey} from "../base_lib/messages/projection.ts";

function isWindowEvent(type:string):boolean {return ["message_received","message_edited","message_deleted","message_updated","message_swiped","chat_id_changed"].includes(type);}
/** 原生回信只落实已登记候选的位置，不把同一生成的完成误当成新写入窗口。 */
function claimNativeReply(s:any,e:any):boolean {
  const candidate=s.nativeCandidate,id=e.args[0],api=s.api;
  if(e.type!=="message_received"||!Number.isSafeInteger(id))return false;
  if(candidate?.phase!=="generating")return false;
  if(candidate.chatId!==api.SillyTavern.getCurrentChatId()||candidate.characterId!==api.getCurrentCharacterId())return false;
  if(candidate.groupId!==(api.SillyTavern.groupId||null))return false;
  const message=api.getChatMessages(id,{include_swipes:true})[0];
  if(!message)return false;
  const fact=projectMessage(message,id,candidate);
  if(!fact.candidate.exists||fact.candidate.generation!==candidate.id)return false;
  s.nativeCandidate={...candidate,messageId:fact.messageId,swipeId:fact.swipeIndex??0,afterMessageId:null};
  return true;
}
/** 写入窗口只在候选归属改变时前进；同次回信和预演不另开窗口。 */
function changesWriteWindow(e:any,nativeOwnedReply:boolean,windowEvent:boolean):boolean {
  if(e.type==="generation_started")return e.args[2]!==true&&!['quiet','impersonate'].includes(e.args[0]);
  if(e.type==="generation_stopped")return true;
  return windowEvent&&!nativeOwnedReply;
}
export function ReadFacts(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,e=f.input;f.event=e;
  f.eventDefinition=s.eventDefinitions.find((d:any)=>d.type===e.type);
  f.ignoreAuxiliary=["generation_started","generation_ended","generation_stopped"].includes(e.type)&&s.auxiliaryGenerationDepth>0;
  f.internalWrite=false;
  f.nativeOwnedReply=claimNativeReply(s,e);
  f.nativeEnded=e.type==="generation_ended";
  f.cancelledEnd=f.nativeEnded&&s.nativeCandidate?.phase==="cancelled";
  if(f.nativeEnded&&!(s.auxiliaryGenerationDepth>0)){
    s.nativeGenerationActive=false;
    if(s.nativeCandidate?.phase === "generating")s.nativeCandidate={...s.nativeCandidate,phase:"completed"};
    if(s.nativeCycle?.identity.chatId===s.api.SillyTavern.getCurrentChatId())s.nativeCycle.resolve({status:"completed",messageId:e.args[0]});
  }
  if(!f.ignoreAuxiliary&&e.type==="message_updated"&&Number.isSafeInteger(e.args[0])){
    const id=e.args[0],expected=s.internalMessageWrites.get(id);
    if(expected!==undefined){f.internalWrite=s.api.getChatMessages(id)[0]?.message===expected;s.internalMessageWrites.delete(id);}
  }
  return emit({frame:f},params);
}
export function ChooseEvent(inputs:any,params:any):any {
  const f=takeFrame(inputs),e=f.event;
  const barrier=f.eventDefinition?.awaitMode==="generation-barrier"&&f.eventDefinition.closesCollectionWindow&&!(e.type==="generation_started"&&e.args[2]===true);
  return emit(route(f,f.ignoreAuxiliary||f.internalWrite||f.cancelledEnd?"ignore":barrier?"barrier":"enqueue"),params);
}
/** 当前分支Node更新事件来源与资源事实；领域规划仍由主Service决定。 */
function prepare(f:any):void {
  const s=f.session,e=f.event,windowEvent=isWindowEvent(e.type);
  if(["message_deleted","message_edited","message_swiped"].includes(e.type)){
    for(const [key,fact] of s.nativeCandidateHistory??[])if(e.type==="message_deleted"||fact.messageId===e.args[0])s.nativeCandidateHistory.delete(key);
    if(s.nativeCandidate&&(e.type==="message_deleted"||s.nativeCandidate.messageId===e.args[0]||s.nativeCandidate.afterMessageId!==null)){
      if(s.nativeGenerationActive){s.nativeCandidateSerial=(s.nativeCandidateSerial??0)+1;s.nativeCandidate={...s.nativeCandidate,id:s.nativeCandidateSerial,predecessor:null};}
      else s.nativeCandidate=null;
    }
  }
  if(["message_sent","generation_stopped","message_swiped","chat_id_changed"].includes(e.type)||e.type==="generation_started"&&e.args[2]!==true&&e.args[0]!=="normal"){
    for(const h of s.handoffs.values())h.resolve(null);s.handoffs.clear();
    for(const c of s.subscriptionCycles??[])c.controller.abort();
  }
  if(e.type==="generation_started"&&e.args[2]!==true){
    s.nativeCycle?.resolve({status:"cancelled",reason:"superseded"});s.nativeCycle=null;s.nativeGenerationActive=true;
    const messages=s.api.getChatMessages("0--1",{include_swipes:true}),last=messages.at(-1);
    const type=e.args[0],existing=["swipe","continue","regenerate"].includes(type);
    const previous=s.nativeCandidate;
    s.nativeCandidateHistory??=new Map();
    if(previous?.chatId===s.api.SillyTavern.getCurrentChatId()&&previous.characterId===s.api.getCurrentCharacterId()&&previous.groupId===(s.api.SillyTavern.groupId||null)){
      for(const [index,message] of messages.entries()){
        const fact=projectMessage(message,index,previous);
        if(fact.candidate.generation===previous.id)s.nativeCandidateHistory.set(candidateFactKey(s.api,fact.messageId,fact.swipeIndex??0),{
          ...previous,messageId:fact.messageId,swipeId:fact.swipeIndex??0,afterMessageId:null,
          phase:previous.phase==="completed"?"completed":"cancelled",
        });
      }
    }
    const prior=last&&existing?s.nativeCandidateHistory.get(candidateFactKey(s.api,last.message_id,Number(last.swipe_id??0))):null;
    s.nativeCandidateSerial=(s.nativeCandidateSerial??0)+1;
    s.nativeCandidate={id:s.nativeCandidateSerial,requestId:s.nativeCandidateSerial,chatId:s.api.SillyTavern.getCurrentChatId(),characterId:s.api.getCurrentCharacterId(),groupId:s.api.SillyTavern.groupId||null,
      messageId:existing?last?.message_id:null,swipeId:Number(last?.swipe_id??0),
      afterMessageId:existing?null:(last?.message_id??-1),predecessor:prior?.phase==="completed"?prior.id:null,type,phase:"preparing"};
  }
  if(e.type==="generation_stopped"||e.type==="chat_id_changed"){
    s.nativeCycle?.resolve({status:"cancelled",reason:e.type==="generation_stopped"?"stopped":"chat-changed"});s.nativeCycle=null;s.nativeGenerationActive=false;
    // 切换聊天会停止进行中的生成，已经完成的回复仍是原聊天里的有效候选。
    if(s.nativeCandidate&&s.nativeCandidate.phase!=="completed")s.nativeCandidate={...s.nativeCandidate,phase:"cancelled"};
  }
  if(e.type==="chat_id_changed"){s.nativeCandidateHistory?.clear();s.sessions.clear();s.agentRecordView?.stopNative();s.agentRecordView?.sessionChanged();}
  if(changesWriteWindow(e,f.nativeOwnedReply,windowEvent))
    s.lifecycleToken=s.lifecycleToken>=Number.MAX_SAFE_INTEGER?1:s.lifecycleToken+1;
  if(e.type==="generation_stopped"||windowEvent){
    for(const call of [...s.functionCalls.values()]){
      let expired=e.type==="generation_stopped";
      try {assertCurrentMessageBasis(s.api, call.sourceBasis, s);}catch {expired=true;}
      if(expired)s.dispatch.functionRelease({session:s,input:{id:call.id}});
    }
  }
  f.input=e;
}
export function PrepareBarrier(inputs:any,params:any):any {const f=takeFrame(inputs);prepare(f);f.generationBarrier=true;return emit({frame:f},params);}
export function PrepareEnqueue(inputs:any,params:any):any {const f=takeFrame(inputs);prepare(f);f.generationBarrier=false;return emit({frame:f},params);}
export function Ignore(inputs:any,params:any):any {const f=takeFrame(inputs);f.result=undefined;return emit({frame:f},params);}
export function ReturnEvent(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,admission=f.result;
  if(f.generationBarrier&&admission?.accepted){
    f.result=s.resources.discard(s.dispatch.waitThrough({session:s,generationBarrier:true,
      input:{sequence:admission.sequence,nativeCandidateRequestId:f.event.type==="generation_started"?s.nativeCandidate?.requestId:null}}));
  }else f.result=undefined;
  return emit({frame:f},params);
}
