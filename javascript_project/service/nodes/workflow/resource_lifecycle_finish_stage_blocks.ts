import {FinishStageBlocksProgress as business} from "../agent/finish_stage_blocks.ts";
import {begin,request,inspect,prepareWait,terminal,advance} from "./resource_progress.ts";
export function Prepare(inputs:any,params:any,context:any):any {const state=begin(business,inputs,params,context.signal);return {state,needs_operation:state.done?'done':'call'};}
export function Skip(inputs:any):any {return {skipped_ready:inputs["era.communication.lifecycle_finish_stage_blocks.state"].value};}
export function Finish(inputs:any):any {return inputs["era.communication.lifecycle_finish_stage_blocks.ready"].value.result;}
export function Request(inputs:any,_params:any,context:any):any {return request(inputs["era.communication.lifecycle_finish_stage_blocks.state"].value,inputs["era.workflow.host_resources"].value.metadata());}
export function Inspect(inputs:any):any {return inspect(inputs["era.communication.lifecycle_finish_stage_blocks.state.pending"].value,inputs["era.workflow.outputs"].value);}
export function Advance(inputs:any,_params:any,context:any):any {return advance(inputs["era.communication.lifecycle_finish_stage_blocks.ready"].value,context.signal);}
