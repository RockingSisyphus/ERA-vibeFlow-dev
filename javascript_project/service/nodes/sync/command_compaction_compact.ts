import { compactEachSegment } from "../../base_lib/command_compaction.ts";
export function run(inputs: any): any { return { compacted: compactEachSegment(inputs["era.command_compaction.partitioned"].value) }; }
