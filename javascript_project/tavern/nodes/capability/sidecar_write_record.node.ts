import {defineNode} from "@vibeflow/plugin";

export const era_tavern_sidecar_write_record_return_file = defineNode({
  "display_name": "交回“保存独立状态文件”的实际结果",
  "description": "接收“保存独立状态文件”已经执行得到的结果，复核实例和本次调用尚未取消后交回发起者。调用方据此继续业务或显示结果，取消时按实际原因结束等待。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_write_record.upload_file","cardinality":"exactly_one","display_name":"交回“保存独立状态文件”的实际结果的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_write_record_return_file_frame","type":"era.tavern.call.frame","display_name":"交回“保存独立状态文件”的实际结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_write_record_return_file_frame"}},"input_semantics":{"era.tavern.frame.sidecar_write_record.upload_file":["保留“交回“保存独立状态文件”的实际结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_write_record_return_file_frame":["保留“交回“保存独立状态文件”的实际结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/capability.ts","export":"ReturnOperation"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_write_record.return_file",
  "node_type": "vibeflow.node"
});
