import {takeFrame,emit,route} from "../../base_lib/frames.ts";
import {completionResource,observeCompletion} from "../../base_lib/resources.ts";
export function ChooseItem(inputs:any,params:any):any {
  const f=takeFrame(inputs);f.notification=f.notificationGroup?.items[f.notificationIndex];
  return emit(route(f,!f.notification?"done":f.notification.type==="era.agent.stage_completed"?"handoff":"event"),params);
}
export function Empty(inputs:any,params:any):any {return emit({frame:takeFrame(inputs),done:true},params);}
export function StartEvent(inputs:any,params:any):any {
  const f=takeFrame(inputs),group=f.notificationGroup,s=f.session;
  const resource=completionResource(f,[group.linked.signal]);f.notificationResource=resource;
  let raw:any,error:any,failed=false;
  try {resource.signal.throwIfAborted();raw=s.api.eventEmit(f.notification.type,...f.notification.args);}catch(reason){failed=true;error=reason;}
  observeCompletion(resource,async()=>{if(failed)throw error;const result=await raw;resource.signal.throwIfAborted();return result;},async outcome=>{if(outcome.status==="rejected")throw outcome.error;return outcome.value;});
  group.tasks.push({...f,kind:"notification",notificationIndex:f.notificationIndex});f.notificationIndex++;
  return emit({frame:f,done:false},params);
}
export function StartHandoff(inputs:any,params:any):any {
  const f=takeFrame(inputs),s=f.session,group=f.notificationGroup,resource=completionResource(f,[group.linked.signal]);
  f.notificationResource=resource;f.completion=structuredClone(f.notification.args[0]);f.handoffSignal=resource.signal;
  let raw:any;
  if(!resource.signal.aborted&&s.handoffs.has(f.completion.completionId)){
    s.subscriptions??=new Set();s.subscriptionCycles??=new Set();
    f.subscriptionCycle={owner:s,controller:new AbortController(),items:[...s.subscriptions],completion:f.completion};
    s.subscriptionCycles.add(f.subscriptionCycle);
    f.proceedPromise=s.dispatch.subscriptionPublish({session:s,action:"subscription_publish",subscriptionCycle:f.subscriptionCycle});
    raw=s.dispatch.handoff({...f,action:"generation_handoff"});
  }
  observeCompletion(resource,async()=>{resource.signal.throwIfAborted();return await raw;},async outcome=>{if(outcome.status==="rejected")throw outcome.error;return outcome.value;});
  group.tasks.push({...f,kind:"notification",notificationIndex:f.notificationIndex});f.notificationIndex++;
  return emit({frame:f,done:false},params);
}
