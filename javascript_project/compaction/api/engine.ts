import {Coordinator} from "../../../kernel/javascript/coordinator.mjs";
import * as expression from "@era/vibeflow-expression/workflow";
import {workflowDescriptor,runWorkflow} from "../generated/release/workflow.js";
import {encodePacket,decodePacket} from "../../../base_lib/workflow_values/codec.mjs";
import type {CommandCompactionResponse} from "../base_lib/command_compaction_engine.ts";
export type {CommandCompactionResponse} from "../base_lib/command_compaction_engine.ts";
/** 公开API保持当场返回；真实流程内的公式调用由官方Coordinator执行。 */
export function compactCommandLayer(input: unknown): CommandCompactionResponse {
  const scope=new Coordinator();
  scope.bind(expression.workflowDescriptor,expression.runWorkflow);
  scope.bind(workflowDescriptor,runWorkflow);
  const result=scope.invoke_sync({workflow:{...workflowDescriptor.workflow,entry:"protocol"},inputs:{wire_request:encodePacket({compaction_request:input})}});
  return decodePacket(result.wireResponse).compactionResponse as CommandCompactionResponse;
}
