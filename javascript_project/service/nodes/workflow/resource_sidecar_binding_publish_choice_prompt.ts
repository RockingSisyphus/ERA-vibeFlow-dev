import {PublishChoicePromptProgress as business} from "../sidecar/shared_choice_adapters.ts";
import {begin,request,inspect,prepareWait,terminal,advance} from "./resource_progress.ts";
export function Prepare(inputs:any,params:any,context:any):any {const state=begin(business,inputs,params,context.signal);return {state,needs_operation:state.done?'done':'call'};}
export function Skip(inputs:any):any {return {skipped_ready:inputs["era.communication.sidecar_binding_publish_choice_prompt.state"].value};}
export function Finish(inputs:any):any {return inputs["era.communication.sidecar_binding_publish_choice_prompt.ready"].value.result;}
export function Request(inputs:any,_params:any,context:any):any {return request(inputs["era.communication.sidecar_binding_publish_choice_prompt.state"].value,inputs["era.workflow.host_resources"].value.metadata());}
export function Inspect(inputs:any):any {return inspect(inputs["era.communication.sidecar_binding_publish_choice_prompt.state.pending"].value,inputs["era.workflow.outputs"].value);}
export function Advance(inputs:any,_params:any,context:any):any {return advance(inputs["era.communication.sidecar_binding_publish_choice_prompt.ready"].value,context.signal);}
