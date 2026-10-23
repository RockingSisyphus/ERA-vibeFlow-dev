import {defineNode} from "@vibeflow/plugin";

export const era_tavern_agent_clear_session_execute = defineNode({
  "display_name": "清除指定聊天或全部生成进度",
  "description": "按请求移除指定聊天的本页生成会话，未指定聊天时清空全部，并结束相关生成观察。通知页面刷新，返回清理确认，供取消或恢复流程使用。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_clear_session.check_request","cardinality":"exactly_one","display_name":"清除指定聊天或全部生成进度的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_clear_session_execute_frame","type":"era.tavern.frame.agent_clear_session.execute","display_name":"清除指定聊天或全部生成进度的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_clear_session_execute_frame"}},"input_semantics":{"era.tavern.frame.agent_clear_session.check_request":["保留“清除指定聊天或全部生成进度”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_clear_session_execute_frame":["保留“清除指定聊天或全部生成进度”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/session.ts","export":"ClearSession"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_clear_session.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_create_error_message_execute = defineNode({
  "display_name": "等待生成失败提示写入聊天",
  "description": "接收已经发起的系统错误消息创建，等待实际结束后返回创建确认。上层据此知道失败说明是否已经显示在聊天中。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待生成失败提示写入聊天的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_create_error_message_execute_frame","type":"era.tavern.frame.agent_create_error_message.execute","display_name":"等待生成失败提示写入聊天的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_create_error_message_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待生成失败提示写入聊天”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_create_error_message_execute_frame":["保留“等待生成失败提示写入聊天”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/agent/session.ts","export":"AwaitErrorMessage"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_create_error_message.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_create_error_message_start_operation = defineNode({
  "display_name": "在聊天中插入生成失败提示",
  "description": "接收生成失败说明，发起系统消息创建并标记为规划失败提示。后续等待消息创建完成，让用户在聊天中看到本次失败及不可继续的状态。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_create_error_message.check_request","cardinality":"exactly_one","display_name":"在聊天中插入生成失败提示的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_create_error_message_start_operation_frame","type":"era.tavern.call.frame","display_name":"在聊天中插入生成失败提示的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_create_error_message_start_operation_frame"}},"input_semantics":{"era.tavern.frame.agent_create_error_message.check_request":["保留“在聊天中插入生成失败提示”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_create_error_message_start_operation_frame":["保留“在聊天中插入生成失败提示”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/session.ts","export":"StartErrorMessage"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_create_error_message.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_inject_once_execute = defineNode({
  "display_name": "为下一次正文生成加入一次性提示",
  "description": "接收提示内容及身份，将提示加入下一次正文生成，并关联到当前生成观察记录。提示只使用一次，供规划阶段把安排交给酒馆正文生成。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_inject_once.check_request","cardinality":"exactly_one","display_name":"为下一次正文生成加入一次性提示的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_inject_once_execute_frame","type":"era.tavern.frame.agent_inject_once.execute","display_name":"为下一次正文生成加入一次性提示的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_inject_once_execute_frame"}},"input_semantics":{"era.tavern.frame.agent_inject_once.check_request":["保留“为下一次正文生成加入一次性提示”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_inject_once_execute_frame":["保留“为下一次正文生成加入一次性提示”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/session.ts","export":"InjectOnce"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_inject_once.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_read_session_binding_execute = defineNode({
  "display_name": "读取当前生成与已有会话的关联",
  "description": "读取当前是否有酒馆生成，以及指定聊天已有生成会话的执行身份和正文请求记录。主服务据此决定沿用还是替换本次会话。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_read_session_binding.check_request","cardinality":"exactly_one","display_name":"读取当前生成与已有会话的关联的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_read_session_binding_execute_frame","type":"era.tavern.frame.agent_read_session_binding.execute","display_name":"读取当前生成与已有会话的关联的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_read_session_binding_execute_frame"}},"input_semantics":{"era.tavern.frame.agent_read_session_binding.check_request":["保留“读取当前生成与已有会话的关联”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_read_session_binding_execute_frame":["保留“读取当前生成与已有会话的关联”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/session.ts","export":"ReadBinding"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_read_session_binding.execute",
  "node_type": "vibeflow.node"
});
