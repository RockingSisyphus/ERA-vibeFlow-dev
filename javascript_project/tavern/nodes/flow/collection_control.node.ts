import {defineNode} from "@vibeflow/plugin";

export const era_tavern_collection_control_apply_commands = defineNode({
  "display_name": "确认本份计时清单已全部处理",
  "description": "接收逐项计时控制循环的结束资料，交给控制消息确认出口。表示清单已安排完成，实际到期事件仍由计时职责分支处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.collection_control.prepare_commands","cardinality":"exactly_one","display_name":"确认本份计时清单已全部处理的请求和已有进度"}],"provides":[{"key":"era_tavern_collection_control_apply_commands_frame","type":"era.tavern.frame.collection_control.apply_commands","display_name":"确认本份计时清单已全部处理的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_collection_control_apply_commands_frame"}},"input_semantics":{"era.tavern.frame.collection_control.prepare_commands":["保留“确认本份计时清单已全部处理”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_collection_control_apply_commands_frame":["保留“确认本份计时清单已全部处理”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.collection_control.apply_commands",
  "node_type": "vibeflow.node"
});
