import { writeSingleScopeSegments } from "../../base_lib/command_compaction.ts";
export function run(inputs: any): any { return { written: writeSingleScopeSegments(inputs["era.command_compaction.replayed"].value) }; }
