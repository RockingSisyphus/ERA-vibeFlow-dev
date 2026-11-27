import {runProgress as business} from "../api/workbench_read_baseline.ts";
import {begin,request,inspect,prepareWait,terminal,advance} from "./resource_progress.ts";
export function Prepare(inputs:any,params:any,context:any):any {const state=begin(business,inputs,params,context.signal);return {state,needs_operation:state.done?'done':'call'};}
export function Skip(inputs:any):any {return {skipped_ready:inputs["era.communication.workbench_read_baseline.state"].value};}
export function Finish(inputs:any):any {return inputs["era.communication.workbench_read_baseline.ready"].value.result;}
export function Request(inputs:any,_params:any,context:any):any {return request(inputs["era.communication.workbench_read_baseline.state"].value,inputs["era.workflow.host_resources"].value.metadata());}
export function Inspect(inputs:any):any {return inspect(inputs["era.communication.workbench_read_baseline.state.pending"].value,inputs["era.workflow.outputs"].value);}
export function Advance(inputs:any,_params:any,context:any):any {return advance(inputs["era.communication.workbench_read_baseline.completed"].value,context.signal);}
export function PrepareWait(inputs:any,_params:any,context:any):any {return prepareWait(inputs["era.communication.workbench_read_baseline.ready"].value,inputs["era.workflow.host_resources"].value.metadata());}
export function AcceptTerminal(inputs:any,_params:any,context:any):any {inputs["era.workflow.host_resources"].value.release(inputs["era.workflow.decoded_terminal"].value.id);return terminal(inputs["era.communication.workbench_read_baseline.ready"].value,inputs["era.workflow.decoded_terminal"].value);}
export function AcceptImmediate(inputs:any):any {return {immediate_completed:inputs["era.communication.workbench_read_baseline.ready"].value};}
