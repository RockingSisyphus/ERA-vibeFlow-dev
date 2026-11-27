import {ApplyFunctionGroupActionProgress as business} from "../sync/core_operation_nodes.ts";
import {createProgress,advanceAsync} from "../../../../base_lib/workflow_progress/progress.ts";
export async function Prepare(inputs:any,params:any,context:any):Promise<any> {const state=await advanceAsync(createProgress(business,inputs,params),undefined,undefined,context.signal);return {state,needs_call:!state.done};}
export function Skip(inputs:any):any {return {skipped_state:inputs["era.migration.service.apply_function_group.state"].value};}
export function Finish(inputs:any):any {return inputs["era.migration.service.apply_function_group.final"].value.result;}
export function Request(inputs:any):any {const state=inputs["era.migration.service.apply_function_group.state"].value;return {payload:{expression_request:state.request.input},retained_state:state};}
export async function Accept(inputs:any,_params:any,context:any):Promise<any> {const state=inputs["era.migration.service.apply_function_group.state.pending"].value,outputs=inputs["era.workflow.outputs"].value;await advanceAsync(state,outputs["expressionResponse"],outputs.workflowFailure,context.signal);return {next_state:state,done:state.done};}
