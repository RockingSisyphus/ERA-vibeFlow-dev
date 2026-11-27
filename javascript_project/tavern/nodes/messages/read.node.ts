import {defineNode} from "@vibeflow/plugin";

export const era_tavern_messages_read_context_execute = defineNode({
  "display_name": "读取指定范围的消息及各个回复",
  "description": "按请求范围读取激活正文、Swipe 位置及候选是否存在，合成历史同步和写入核对使用的消息投影。外部提交可在读指定楼层时要求编辑器关闭，若正在编辑则返回冲突错误。成功结果保持统一的消息格式。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_read_context.check_request","cardinality":"exactly_one","display_name":"读取指定范围的消息及各个回复的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_read_context_execute_frame","type":"era.tavern.frame.messages_read_context.execute","display_name":"读取指定范围的消息及各个回复的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_read_context_execute_frame"}},"input_semantics":{"era.tavern.frame.messages_read_context.check_request":["保留“读取指定范围的消息及各个回复”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_read_context_execute_frame":["保留“读取指定范围的消息及各个回复”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/read.ts","export":"ReadContext"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_read_context.execute",
  "node_type": "vibeflow.node"
});
