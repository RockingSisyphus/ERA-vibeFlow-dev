import {runProgress as business} from "../verify_layer.ts";
import {createProgress,advanceSync} from "../../../../base_lib/workflow_progress/progress.ts";
export function Prepare(inputs:any,params:any,context:any):any {const state=advanceSync(createProgress(business,inputs,params),undefined,undefined,context.signal);return {state,needs_call:!state.done};}
export function Skip(inputs:any):any {return {skipped_state:inputs["era.migration.compaction.verify_layer.state"].value};}
export function Finish(inputs:any):any {return inputs["era.migration.compaction.verify_layer.final"].value.result;}
export function Request(inputs:any):any {const state=inputs["era.migration.compaction.verify_layer.state"].value;return {payload:{expression_request:state.request.input},retained_state:state};}
export function Accept(inputs:any,_params:any,context:any):any {const state=inputs["era.migration.compaction.verify_layer.state.pending"].value,outputs=inputs["era.workflow.outputs"].value;advanceSync(state,outputs["expressionResponse"],outputs.workflowFailure,context.signal);return {next_state:state,done:state.done};}
