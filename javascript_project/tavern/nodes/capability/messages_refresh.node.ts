import {defineNode} from "@vibeflow/plugin";

export const era_tavern_messages_refresh_return_refresh = defineNode({
  "display_name": "交回“刷新消息显示”的实际结果",
  "description": "接收“刷新消息显示”已经执行得到的结果，复核实例和本次调用尚未取消后交回发起者。调用方据此继续业务或显示结果，取消时按实际原因结束等待。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_refresh.refresh","cardinality":"exactly_one","display_name":"交回“刷新消息显示”的实际结果的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_refresh_return_refresh_frame","type":"era.tavern.call.frame","display_name":"交回“刷新消息显示”的实际结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_refresh_return_refresh_frame"}},"input_semantics":{"era.tavern.frame.messages_refresh.refresh":["保留“交回“刷新消息显示”的实际结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_refresh_return_refresh_frame":["保留“交回“刷新消息显示”的实际结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/capability.ts","export":"ReturnOperation"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.frames"],
  "id": "era.tavern.messages_refresh.return_refresh",
  "node_type": "vibeflow.node"
});
