import { parseScopedTransactions } from "../../base_lib/command_compaction.ts";
export function run(inputs: any): any { return { parsed: parseScopedTransactions(inputs["era.command_compaction.identified"].value) }; }
