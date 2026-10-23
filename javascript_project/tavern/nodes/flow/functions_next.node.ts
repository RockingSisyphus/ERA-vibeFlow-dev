import {defineNode} from "@vibeflow/plugin";

export const era_tavern_functions_next_return_request = defineNode({
  "display_name": "将作者请求或结束结论交回消息流程",
  "description": "接收本次已取得的作者操作或函数结束结果，交给等待中的消息处理。变量提交在该函数所在正文位置执行，不进入会等待自身结束的外部事件队列。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_next.wait_request","cardinality":"exactly_one","display_name":"将作者请求或结束结论交回消息流程的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_next_return_request_frame","type":"era.tavern.call.frame","display_name":"将作者请求或结束结论交回消息流程的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_next_return_request_frame"}},"input_semantics":{"era.tavern.frame.functions_next.wait_request":["保留“将作者请求或结束结论交回消息流程”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_next_return_request_frame":["保留“将作者请求或结束结论交回消息流程”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.functions_next.return_request",
  "node_type": "vibeflow.node"
});
