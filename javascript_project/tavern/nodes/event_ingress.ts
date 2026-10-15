import {takeFrame,emit,route} from "../base_lib/frames.ts";
import {assertCurrentMessageBasis} from "../base_lib/messages/target.ts";

function isWindowEvent(type:string):boolean {return ["message_received","message_edited","message_deleted","message_updated","message_swiped","chat_id_changed"].includes(type);}
export function ReadFacts(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,e=f.input;f.event=e;
  f.eventDefinition=s.eventDefinitions.find((d:any)=>d.type===e.type);
  f.ignoreAuxiliary=e.type==="generation_started"&&s.auxiliaryGenerationDepth>0;
  f.internalWrite=false;
  f.nativeEnded=e.type==="generation_ended";
  if(f.nativeEnded&&!(s.auxiliaryGenerationDepth>0)){
    s.nativeGenerationActive=false;
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
  return emit(route(f,f.ignoreAuxiliary||f.internalWrite||f.nativeEnded?"ignore":barrier?"barrier":"enqueue"),params);
}
/** 当前分支Node更新事件来源与资源事实；领域规划仍由主Service决定。 */
function prepare(f:any):void {
  const s=f.session,e=f.event;
  if(["message_sent","generation_stopped","message_swiped","chat_id_changed"].includes(e.type)||e.type==="generation_started"&&e.args[2]!==true&&e.args[0]!=="normal"){
    for(const h of s.handoffs.values())h.resolve(null);s.handoffs.clear();
    for(const c of s.subscriptionCycles??[])c.controller.abort();
  }
  if(e.type==="generation_started"&&e.args[2]!==true){s.nativeCycle?.resolve({status:"cancelled",reason:"superseded"});s.nativeCycle=null;s.nativeGenerationActive=true;}
  if(e.type==="generation_stopped"||e.type==="chat_id_changed"){
    s.nativeCycle?.resolve({status:"cancelled",reason:e.type==="generation_stopped"?"stopped":"chat-changed"});s.nativeCycle=null;s.nativeGenerationActive=false;
  }
  if(e.type==="chat_id_changed"){s.sessions.clear();s.agentRecordView?.stopNative();s.agentRecordView?.sessionChanged();}
  if(isWindowEvent(e.type))s.lifecycleToken=s.lifecycleToken>=Number.MAX_SAFE_INTEGER?1:s.lifecycleToken+1;
  if(e.type==="generation_stopped"||isWindowEvent(e.type)){
    for(const call of [...s.functionCalls.values()]){
      let expired=e.type==="generation_stopped";
      try {assertCurrentMessageBasis(s.api,call.sourceBasis);}catch {expired=true;}
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
    f.result=s.resources.discard(s.dispatch.waitThrough({session:s,generationBarrier:true,input:{sequence:admission.sequence}}));
  }else f.result=undefined;
  return emit({frame:f},params);
}
