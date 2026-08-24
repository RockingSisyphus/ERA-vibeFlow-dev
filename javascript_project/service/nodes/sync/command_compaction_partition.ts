import { partitionSameScopeSegments } from "../../base_lib/command_compaction.ts";
export function run(inputs: any): any { return { partitioned: partitionSameScopeSegments(inputs["era.command_compaction.parsed"].value) }; }
