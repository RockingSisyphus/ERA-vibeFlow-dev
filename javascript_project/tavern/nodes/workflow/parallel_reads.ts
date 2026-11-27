import {assertRunning} from "../../base_lib/frames.ts";
const take=(inputs:any):any=>Object.values(inputs).flat().map((x:any)=>x.value)[0];
const emit=(params:any,values:any[]):any=>Object.fromEntries(params.keys.map((key:string,i:number)=>[key,values[i]]));
function requestFor(slot:string):any {return {
 identity:{family:'identity',operation:'read'},variables:{family:'variables',operation:'read'},worldbook:{family:'worldbook',operation:'read'},regex:{family:'regex',operation:'read'},character:{family:'character',operation:'read_main_greeting'},messages:{family:'messages',operation:'read_context'},current:{family:'sidecar',operation:'read_current'}
}[slot];}
export function Dispatch(inputs:any,params:any):any{return emit(params,[take(inputs)]);}
export function PrepareSlot(inputs:any,params:any):any {
 const group=take(inputs),slot=params.slot,selected=group.kind==='initialization'?['identity','variables','worldbook','regex','character']:group.latest?['messages','identity']:['messages','identity','current','variables'];
 const purpose=group.kind==='initialization'?'era-initialize':slot==='variables'?'era-dispatch-placeholder':'era-dispatch-prepare';
 const input=slot==='variables'?{scope:{type:'script'},purpose}:slot==='messages'?{projection:'era-active-message-v2',range:'0--1',purpose}:slot==='current'?{}:{purpose};
 return emit(params,[{group,slot,...requestFor(slot),input},selected.includes(slot)?'read':'skip']);
}
export function SkipSlot(inputs:any,params:any):any{return emit(params,[{slot:params.slot,skipped:true}]);}
export function JoinSlot(inputs:any,params:any):any{return emit(params,[take(inputs)]);}
export function PrepareRead(inputs:any):any {const request=take(inputs),group=request.group;assertRunning(group.session);group.operationScope.controller.signal.throwIfAborted();return {slot_frame:{action:'capability',origin:'service',...requestFor(request.slot),input:request.input,session:group.session,dispatch:group.session.dispatch,options:{signal:group.operationScope.controller.signal},operationScope:group.operationScope,slot:request.slot}};}
export function ClassifyRead(inputs:any):any {const frame=take(inputs);return {prepared_slot:frame,read_route:frame.publicPromise?'wait':'immediate'};}
function project(frame:any):any {for(const resource of frame.operationScope.resources)if(resource===frame.operationResource||resource===frame.modelResource)resource.completion.resolve(frame.result);return {slot:frame.slot,value:frame.result};}
export function ProjectReadWait(inputs:any):any{return {wait_reply:project(take(inputs))};}
export function ProjectReadImmediate(inputs:any):any{return {immediate_reply:project(take(inputs))};}
export function Collect(inputs:any,params:any):any {const replies=inputs['era.tavern.read_slot.reply'];return emit(params,[Object.fromEntries(replies.filter((r:any)=>!r.value.skipped).map((r:any)=>[r.value.slot,r.value.value]))]);}
