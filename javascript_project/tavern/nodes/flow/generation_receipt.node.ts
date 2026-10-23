import {defineNode} from "@vibeflow/plugin";

export const era_tavern_generation_receipt_join_result = defineNode({
  "display_name": "交接等待用户重试引起的完整生成结果的选中结果",
  "description": "在“等待用户重试引起的完整生成结果”中，接收本次实际选择的分支所产生的唯一结果，交给后续步骤或调用方。每次只允许一份实际结果，避免把互斥分支误当成多个都已执行。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.generation_receipt.cancelled","cardinality":"all","display_name":"交接等待用户重试引起的完整生成结果的选中结果的请求和已有进度"},{"type":"era.tavern.frame.generation_receipt.completed","cardinality":"all","display_name":"交接等待用户重试引起的完整生成结果的选中结果的请求和已有进度"},{"type":"era.tavern.frame.generation_receipt.original","cardinality":"all","display_name":"交接等待用户重试引起的完整生成结果的选中结果的请求和已有进度"}],"provides":[{"key":"generation_receipt_join_result_frame","type":"era.tavern.call.frame","display_name":"交接等待用户重试引起的完整生成结果的选中结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"generation_receipt_join_result_frame"}},"input_semantics":{"era.tavern.frame.generation_receipt.cancelled":["保留“交接等待用户重试引起的完整生成结果的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"],"era.tavern.frame.generation_receipt.completed":["保留“交接等待用户重试引起的完整生成结果的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"],"era.tavern.frame.generation_receipt.original":["保留“交接等待用户重试引起的完整生成结果的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"generation_receipt_join_result_frame":["保留“交接等待用户重试引起的完整生成结果的选中结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Join"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.generation_receipt.join_result",
  "node_type": "vibeflow.node"
});
