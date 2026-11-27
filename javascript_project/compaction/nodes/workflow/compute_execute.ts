import {runProgress as business} from "../execute_original_semantics.ts";
import {createProgress,advanceSync} from "../../../../base_lib/workflow_progress/progress.ts";
export function Prepare(inputs:any,params:any,context:any):any {const state=advanceSync(createProgress(business,inputs,params),undefined,undefined,context.signal);return {state,needs_call:!state.done};}
export function Skip(inputs:any):any {return {skipped_state:inputs["era.migration.compaction.execute.state"].value};}
export function Finish(inputs:any):any {return inputs["era.migration.compaction.execute.final"].value.result;}
export function Request(inputs:any):any {const state=inputs["era.migration.compaction.execute.state"].value;return {payload:{expression_request:state.request.input},retained_state:state};}
export function Accept(inputs:any,_params:any,context:any):any {const state=inputs["era.migration.compaction.execute.state.pending"].value,outputs=inputs["era.workflow.outputs"].value;advanceSync(state,outputs["expressionResponse"],outputs.workflowFailure,context.signal);return {next_state:state,done:state.done};}
