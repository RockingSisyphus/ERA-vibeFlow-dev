import { identifySealedLayers } from "../../base_lib/command_compaction.ts";
export function run(inputs: any): any { return { identified: identifySealedLayers(inputs["era.expression.command.result"].value) }; }
