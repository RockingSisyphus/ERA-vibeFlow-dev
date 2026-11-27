import {assertRunning,EraServiceHostError} from "../../base_lib/frames.ts";
import {deferred,abortable,linkedSignals,dequeueEvent} from "../../base_lib/resources.ts";
import {decodePacket} from "../../../../base_lib/workflow_values/codec.mjs";
const val=(inputs:any,key:string):any=>inputs[key].value;
const frame=(inputs:any):any=>({...val(inputs,"era.tavern.call.frame")});
const address=(inputs:any):any=>inputs["era.workflow.host_resources"].value.metadata({});
export function PrepareService(inputs:any,_params:any,context:any):any {
 const f=frame(inputs);f.session.communicationJoin=deferred();
 return {inputs:{},local_owner:f};
}
export function Register(inputs:any,_params:any,context:any):any {
 const f={...val(inputs,"era.workflow.local_owner")},id=val(inputs,"era.workflow.instance");
 if(address(inputs).serviceId!==id)throw new Error("主服务归属未在Call返回前登记。");
 f.serviceInstance=id;return {frame:f};
}
export function AnnounceEnd(inputs:any,_params:any,context:any):any {
 const f=frame(inputs),s=f.session,ended=val(inputs,"era.workflow.terminal");
 const expectedStop=s.stopping||s.lifecycle.signal.aborted;
 s.dispatch.stopPrefix({session:s,input:{reason:"service-ended"}});
 return {send_request:{id:address(inputs).runtimeId,port:"era.service.out",payload:{kind:"end"}},service_completion:{terminal:ended,expectedStop}};
}
export function EndPull(inputs:any,_params:any,context:any):any {return {pull_end_request:{id:address(inputs).runtimeId,port:"era.service.pull",payload:{kind:"end"}}};}
export function WaitDone(inputs:any):any {return {wait_done:val(inputs,"era.workflow.service_completion")};}
export async function ObserveStop(inputs:any,_params:any,context:any):Promise<any> {
 const f=frame(inputs),s=f.session;
 if(!s.stopping&&!s.lifecycle.signal.aborted){
  const stopped=deferred(),stop=()=>stopped.resolve();s.lifecycle.signal.addEventListener('abort',stop,{once:true});
  try{if(s.lifecycle.signal.aborted)stop();await abortable(()=>stopped.promise,linkedSignals([context.signal]));}
  finally{s.lifecycle.signal.removeEventListener('abort',stop);}
 }
 return {observed:{stopped:true}};
}
export function StopDone(inputs:any):any{return {stop_done:val(inputs,"era.workflow.stopped")};}
export function Collect(inputs:any):any {
 const f=val(inputs,"era.workflow.events_branch"),completion=val(inputs,"era.workflow.wait_branch"),ended=completion.terminal;
 try{if(ended.state==='failed'||ended.state==='cancelled'&&!completion.expectedStop){const e:any=new Error(ended.error?.message??'主服务失败');Object.assign(e,ended.error);throw e;}return {service_finished:{status:'service-ended'}};}
 finally{f.session.communicationJoin.resolve();}
}
export function Retain(inputs:any):any{return {pull_owner:frame(inputs)};}
export function CheckPull(inputs:any,_params:any,context:any):any {
 const f=val(inputs,"era.workflow.local_owner"),m=val(inputs,"vibeflow.workflow.receive.result"),a=address(inputs),body=decodePacket(m.payload);
 const end=m.sender===a.runtimeId&&body.kind==='end';
 if(m.port!=='era.service.pull'||!end&&(m.sender!==a.serviceId||body.kind!=='pull'))throw new TypeError('取件请求身份或内容错误。');
 return {pull_frame:f,should_pull:!end};
}
export async function TakeEvent(inputs:any,_params:any,context:any):Promise<any> {
 const f=frame(inputs),s=f.session;
 if(s.stopping||s.lifecycle.signal.aborted)return {send_request:{id:address(inputs).serviceId,payload:null},has_event:false,local_owner:f};
 assertRunning(s);if(!s.unsubscribe)throw new EraServiceHostError('ERA_HOST_INGRESS_INACTIVE','ERA服务入口尚未激活。');
 try{const event=await dequeueEvent(s,context.signal);return {send_request:{id:address(inputs).serviceId,port:'era.service.in',payload:event},has_event:true,local_owner:f};}
 catch(error){if(context.signal.aborted||!s.stopping&&!s.lifecycle.signal.aborted)throw error;return {send_request:{id:address(inputs).serviceId,payload:null},has_event:false,local_owner:f};}
}
export function Sent(inputs:any):any{const delivery=val(inputs,"era.workflow.event_delivery");return {next_frame:delivery.owner,done:delivery.closed||delivery.owner.session.stopping};}
export function Closed(inputs:any):any{return {closed_frame:val(inputs,"era.workflow.local_owner"),closed_done:true};}
export function ClosedControl(inputs:any):any{return {control_closed_frame:frame(inputs),control_closed_done:true};}
