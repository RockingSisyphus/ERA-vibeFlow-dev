import {prepareCandidatesProgress as business} from "../sync/compaction_replay.ts";
import {createProgress,advanceSync} from "../../../../base_lib/workflow_progress/progress.ts";
export function Prepare(inputs:any,params:any,context:any):any {const state=advanceSync(createProgress(business,inputs,params),undefined,undefined,context.signal);return {state,needs_call:!state.done};}
export function Skip(inputs:any):any {return {skipped_state:inputs["era.migration.service.prepare_candidates.state"].value};}
export function Finish(inputs:any):any {return inputs["era.migration.service.prepare_candidates.final"].value.result;}
export function Request(inputs:any):any {const state=inputs["era.migration.service.prepare_candidates.state"].value;return {payload:{compaction_request:state.request.input},retained_state:state};}
export function Accept(inputs:any,_params:any,context:any):any {const state=inputs["era.migration.service.prepare_candidates.state.pending"].value,outputs=inputs["era.workflow.outputs"].value;advanceSync(state,outputs["compactionResponse"],outputs.workflowFailure,context.signal);return {next_state:state,done:state.done};}
