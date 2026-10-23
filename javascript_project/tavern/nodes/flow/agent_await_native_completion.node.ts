import {defineNode} from "@vibeflow/plugin";

export const era_tavern_agent_await_native_completion_return_native = defineNode({
  "display_name": "返回指定酒馆生成的结束及最新消息",
  "description": "接收本次生成结束状态和重新读取的聊天、最新消息，交回主服务。主服务可据此确认正文仍属于原生成，再继续规划或结算。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_await_native_completion.read_current","cardinality":"exactly_one","display_name":"返回指定酒馆生成的结束及最新消息的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_await_native_completion_return_native_frame","type":"era.tavern.call.frame","display_name":"返回指定酒馆生成的结束及最新消息的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_await_native_completion_return_native_frame"}},"input_semantics":{"era.tavern.frame.agent_await_native_completion.read_current":["保留“返回指定酒馆生成的结束及最新消息”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_await_native_completion_return_native_frame":["保留“返回指定酒馆生成的结束及最新消息”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_await_native_completion.return_native",
  "node_type": "vibeflow.node"
});
