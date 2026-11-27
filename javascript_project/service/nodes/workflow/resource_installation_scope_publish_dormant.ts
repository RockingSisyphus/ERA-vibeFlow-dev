import {PublishDormantStartupProgress as business} from "../initialize/shared_pure_adapters.ts";
import {begin,request,inspect,prepareWait,terminal,advance} from "./resource_progress.ts";
export function Prepare(inputs:any,params:any,context:any):any {const state=begin(business,inputs,params,context.signal);return {state,needs_operation:state.done?'done':'call'};}
export function Skip(inputs:any):any {return {skipped_ready:inputs["era.communication.installation_scope_publish_dormant.state"].value};}
export function Finish(inputs:any):any {return inputs["era.communication.installation_scope_publish_dormant.ready"].value.result;}
export function Request(inputs:any,_params:any,context:any):any {return request(inputs["era.communication.installation_scope_publish_dormant.state"].value,inputs["era.workflow.host_resources"].value.metadata());}
export function Inspect(inputs:any):any {return inspect(inputs["era.communication.installation_scope_publish_dormant.state.pending"].value,inputs["era.workflow.outputs"].value);}
export function Advance(inputs:any,_params:any,context:any):any {return advance(inputs["era.communication.installation_scope_publish_dormant.ready"].value,context.signal);}
