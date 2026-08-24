import { replayWithServiceEngine } from "../../base_lib/command_compaction.ts";
export function run(inputs: any): any { return { replayed: replayWithServiceEngine(inputs["era.command_compaction.compacted"].value) }; }
