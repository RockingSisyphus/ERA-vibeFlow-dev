import { updateCompactionMarkers } from "../../base_lib/command_compaction.ts";
export function run(inputs: any): any { return { command_compaction_result: updateCompactionMarkers(inputs["era.command_compaction.written"].value) }; }
