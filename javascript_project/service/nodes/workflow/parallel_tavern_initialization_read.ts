import {ReadInitializationContextProgress as business} from "../initialize/shared_initialization_adapters.ts";
import {createProgress,advanceSync} from "../../../../base_lib/workflow_progress/progress.ts";
const state=(inputs:any):any=>inputs["era.communication.tavern_initialization_read.state"].value;
export function Prepare(inputs:any,params:any,context:any):any {const pending=advanceSync(createProgress(business,inputs,params),undefined,undefined,context.signal);return {inputs:{...pending.request.input,ownerToken:inputs["era.workflow.host_resources"].value.metadata().ownerToken},pending};}
function resume(inputs:any,context:any):any {const pending=state(inputs),ended=inputs["era.workflow.decoded_terminal"].value;inputs["era.workflow.host_resources"].value.release(ended.id);const failure=ended.state==='succeeded'?undefined:Object.assign(new Error(ended.error?.message??'读取失败'),ended.error);return advanceSync(pending,ended.outputs?.result,failure,context.signal);}
export function Finish(inputs:any,_params:any,context:any):any {return resume(inputs,context).result;}
