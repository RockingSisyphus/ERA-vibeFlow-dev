import {defineNode} from "@vibeflow/plugin";

export const era_tavern_agent_await_native_completion_check_identity = defineNode({
  "display_name": "确认要等待的是哪次聊天生成",
  "description": "检查等待请求是否明确给出聊天和生成执行身份。后续仅等待这次对应生成，避免误用用户后来启动的新生成。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"确认要等待的是哪次聊天生成的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_await_native_completion_check_identity_frame","type":"era.tavern.frame.agent_await_native_completion.check_identity","display_name":"确认要等待的是哪次聊天生成的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_await_native_completion_check_identity_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“确认要等待的是哪次聊天生成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_await_native_completion_check_identity_frame":["保留“确认要等待的是哪次聊天生成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/native-wait.ts","export":"CheckIdentity"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_await_native_completion.check_identity",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_await_native_completion_read_current = defineNode({
  "display_name": "生成结束后重新读取聊天和最新消息",
  "description": "指定生成结束后，重新读取当前会话进度、聊天身份及最新消息，只返回当前候选正文和ERA阶段标记，连同结束结论返回。主服务据此确认结果仍属于原聊天和原次生成，再继续规划或结算。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_await_native_completion.wait_terminal","cardinality":"exactly_one","display_name":"生成结束后重新读取聊天和最新消息的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_await_native_completion_read_current_frame","type":"era.tavern.frame.agent_await_native_completion.read_current","display_name":"生成结束后重新读取聊天和最新消息的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_await_native_completion_read_current_frame"}},"input_semantics":{"era.tavern.frame.agent_await_native_completion.wait_terminal":["保留“生成结束后重新读取聊天和最新消息”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_await_native_completion_read_current_frame":["保留“生成结束后重新读取聊天和最新消息”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/native-wait.ts","export":"ReadCurrent"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_await_native_completion.read_current",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_await_native_completion_start_operation = defineNode({
  "display_name": "登记对指定酒馆生成的结束等待",
  "description": "捕获请求指定的聊天和当前生成周期。属于该周期时等待其结束，非酒馆生成时返回对应状态，周期已变化时返回取消原因；后续不会借用新生成的完成结果。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_await_native_completion.check_identity","cardinality":"exactly_one","display_name":"登记对指定酒馆生成的结束等待的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_await_native_completion_start_operation_frame","type":"era.tavern.call.frame","display_name":"登记对指定酒馆生成的结束等待的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_await_native_completion_start_operation_frame"}},"input_semantics":{"era.tavern.frame.agent_await_native_completion.check_identity":["保留“登记对指定酒馆生成的结束等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_await_native_completion_start_operation_frame":["保留“登记对指定酒馆生成的结束等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/native-wait.ts","export":"StartOperation"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_await_native_completion.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_await_native_completion_wait_terminal = defineNode({
  "display_name": "等待已登记的酒馆生成结束",
  "description": "接收已经绑定到某次聊天生成的等待，取得其完成、取消或非酒馆生成状态。随后重新读取聊天及最新消息，供主服务判断正文是否仍适用。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待已登记的酒馆生成结束的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_await_native_completion_wait_terminal_frame","type":"era.tavern.frame.agent_await_native_completion.wait_terminal","display_name":"等待已登记的酒馆生成结束的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_await_native_completion_wait_terminal_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待已登记的酒馆生成结束”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_await_native_completion_wait_terminal_frame":["保留“等待已登记的酒馆生成结束”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/agent/native-wait.ts","export":"WaitTerminal"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_await_native_completion.wait_terminal",
  "node_type": "vibeflow.node"
});
