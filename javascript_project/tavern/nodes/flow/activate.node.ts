import {defineNode} from "@vibeflow/plugin";

export const era_tavern_activate_join_settle_startup = defineNode({
  "display_name": "交接按脚本启用决定连接聊天和界面的选中结果",
  "description": "在“按脚本启用决定连接聊天和界面”中，接收本次实际选择的分支所产生的唯一结果，交给后续步骤或调用方。每次只允许一份实际结果，避免把互斥分支误当成多个都已执行。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.activate.choose_scope","cardinality":"all","display_name":"交接按脚本启用决定连接聊天和界面的选中结果的请求和已有进度"}],"provides":[{"key":"era_tavern_activate_join_settle_startup_frame","type":"era.tavern.frame.activate.choose_scope","display_name":"交接按脚本启用决定连接聊天和界面的选中结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_activate_join_settle_startup_frame"}},"input_semantics":{"era.tavern.frame.activate.choose_scope":["保留“交接按脚本启用决定连接聊天和界面的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_activate_join_settle_startup_frame":["保留“交接按脚本启用决定连接聊天和界面的选中结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Join"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.contracts","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.activate.join_settle_startup",
  "node_type": "vibeflow.node"
});
