import {runProgress as business} from "../dispatch/read_canonical_context.ts";
import {createProgress,advanceSync} from "../../../../base_lib/workflow_progress/progress.ts";
import {inspect,prepareWait,terminal,advance} from "./resource_progress.ts";
const state=(inputs:any):any=>inputs["era.communication.dispatch_read_canonical_context.state"].value;
const ready=(inputs:any):any=>inputs["era.communication.dispatch_read_canonical_context.ready"].value;
export function Prepare(inputs:any,params:any,context:any):any {const pending=advanceSync(createProgress(business,inputs,params),undefined,undefined,context.signal);return {inputs:{...pending.request.input,ownerToken:inputs["era.workflow.host_resources"].value.metadata().ownerToken},pending};}
function resume(inputs:any,context:any):any {const pending=state(inputs),ended=inputs["era.workflow.decoded_terminal"].value;inputs["era.workflow.host_resources"].value.release(ended.id);const failure=ended.state==='succeeded'?undefined:Object.assign(new Error(ended.error?.message??'读取失败'),ended.error);return advanceSync(pending,ended.outputs?.result,failure,context.signal);}
export function Inspect(inputs:any,_params:any,context:any):any {const value=resume(inputs,context);return {ready:value,record_route:value.done?'finish':'read'};}
export function FinishWithout(inputs:any):any {return ready(inputs).result;}
export function RecordRequest(inputs:any,_params:any,context:any):any {const pending=ready(inputs);return {inputs:{...pending.request,ownerToken:inputs["era.workflow.host_resources"].value.metadata().ownerToken},pending};}
export function ChooseWait(inputs:any):any {const value=inputs["era.communication.dispatch_read_canonical_context.record_pending"].value;const result=inspect(value,inputs["era.workflow.outputs"].value);return {waiting_ready:value,wait_route:result.wait_route};}
export function PrepareWait(inputs:any,_params:any,context:any):any {return {wait_payload:prepareWait(ready(inputs),inputs["era.workflow.host_resources"].value.metadata()).payload_async};}
export function MergeAsync(inputs:any,_params:any,context:any):any {const value=ready(inputs),ended=inputs["era.workflow.decoded_terminal"].value;inputs["era.workflow.host_resources"].value.release(ended.id);terminal(value,ended);advance(value,context.signal);return {async_context:value.result.canonical_dispatch_context};}
export function MergeImmediate(inputs:any,_params:any,context:any):any {const value=ready(inputs);advance(value,context.signal);return value.result;}
