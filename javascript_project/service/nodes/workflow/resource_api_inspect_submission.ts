import {inspectSubmissionProgress as business} from "../api/facade_nodes.ts";
import {begin,request,inspect,prepareWait,terminal,advance} from "./resource_progress.ts";
export function Prepare(inputs:any,params:any,context:any):any {const state=begin(business,inputs,params,context.signal);return {state,needs_operation:state.done?'done':'call'};}
export function Skip(inputs:any):any {return {skipped_ready:inputs["era.communication.api_inspect_submission.state"].value};}
export function Finish(inputs:any):any {return inputs["era.communication.api_inspect_submission.ready"].value.result;}
export function Request(inputs:any,_params:any,context:any):any {return request(inputs["era.communication.api_inspect_submission.state"].value,inputs["era.workflow.host_resources"].value.metadata());}
export function Inspect(inputs:any):any {return inspect(inputs["era.communication.api_inspect_submission.state.pending"].value,inputs["era.workflow.outputs"].value);}
export function Advance(inputs:any,_params:any,context:any):any {return advance(inputs["era.communication.api_inspect_submission.completed"].value,context.signal);}

export function PrepareWait(inputs:any,_params:any,context:any):any {return prepareWait(inputs["era.communication.api_inspect_submission.ready"].value,inputs["era.workflow.host_resources"].value.metadata());}
export function AcceptTerminal(inputs:any,_params:any,context:any):any {inputs["era.workflow.host_resources"].value.release(inputs["era.workflow.decoded_terminal"].value.id);return terminal(inputs["era.communication.api_inspect_submission.ready"].value,inputs["era.workflow.decoded_terminal"].value);}
export function AcceptImmediate(inputs:any):any {return {immediate_completed:inputs["era.communication.api_inspect_submission.ready"].value};}
