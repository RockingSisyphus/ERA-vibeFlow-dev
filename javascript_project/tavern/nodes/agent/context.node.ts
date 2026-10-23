import {defineNode} from "@vibeflow/plugin";

export const era_tavern_agent_capture_preset_execute = defineNode({
  "display_name": "读取选定预设的生成设置",
  "description": "读取指定酒馆预设中的生成相关内容，整理名称和配置资料。群聊不支持该操作时返回原因，成功资料供生成设置管理使用。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_capture_preset.check_request","cardinality":"exactly_one","display_name":"读取选定预设的生成设置的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_capture_preset_execute_frame","type":"era.tavern.frame.agent_capture_preset.execute","display_name":"读取选定预设的生成设置的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_capture_preset_execute_frame"}},"input_semantics":{"era.tavern.frame.agent_capture_preset.check_request":["保留“读取选定预设的生成设置”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_capture_preset_execute_frame":["保留“读取选定预设的生成设置”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/context.ts","export":"CapturePreset"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_capture_preset.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_read_configuration_sources_execute = defineNode({
  "display_name": "列出可选预设及本机连接方案",
  "description": "读取当前预设名称、可选预设和本机连接摘要，整理为设置界面可以展示的来源列表。连接摘要不包含密钥，供用户选择多阶段生成的配置来源。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_read_configuration_sources.check_request","cardinality":"exactly_one","display_name":"列出可选预设及本机连接方案的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_read_configuration_sources_execute_frame","type":"era.tavern.frame.agent_read_configuration_sources.execute","display_name":"列出可选预设及本机连接方案的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_read_configuration_sources_execute_frame"}},"input_semantics":{"era.tavern.frame.agent_read_configuration_sources.check_request":["保留“列出可选预设及本机连接方案”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_read_configuration_sources_execute_frame":["保留“列出可选预设及本机连接方案”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/context.ts","export":"ReadSources"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_read_configuration_sources.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_read_connection_state_execute = defineNode({
  "display_name": "读取指定本机连接是否存在",
  "description": "查看本机连接库的数量，以及请求指定的方案是否存在，存在时交出不含密钥的摘要。生成设置流程据此判断继续使用、修改或重新绑定。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_read_connection_state.check_request","cardinality":"exactly_one","display_name":"读取指定本机连接是否存在的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_read_connection_state_execute_frame","type":"era.tavern.frame.agent_read_connection_state.execute","display_name":"读取指定本机连接是否存在的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_read_connection_state_execute_frame"}},"input_semantics":{"era.tavern.frame.agent_read_connection_state.check_request":["保留“读取指定本机连接是否存在”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_read_connection_state_execute_frame":["保留“读取指定本机连接是否存在”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/context.ts","export":"ReadConnectionState"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_read_connection_state.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_read_context_execute = defineNode({
  "display_name": "读取生成所需的聊天、设置和变量",
  "description": "读取当前聊天身份、最新消息、最近历史、生成配置和本页生成进度，并带入已经发布的变量读数。将同一时刻的资料交给主服务，供它决定生成阶段及模型输入。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_read_context.check_request","cardinality":"exactly_one","display_name":"读取生成所需的聊天、设置和变量的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_read_context_execute_frame","type":"era.tavern.frame.agent_read_context.execute","display_name":"读取生成所需的聊天、设置和变量的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_read_context_execute_frame"}},"input_semantics":{"era.tavern.frame.agent_read_context.check_request":["保留“读取生成所需的聊天、设置和变量”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_read_context_execute_frame":["保留“读取生成所需的聊天、设置和变量”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/context.ts","export":"ReadContext"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_read_context.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_write_configuration_execute = defineNode({
  "display_name": "等待角色生成配置保存完成",
  "description": "接收已经发起的角色配置写入，等待酒馆保存完成。保留成功或失败结果，供设置请求返回真实确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待角色生成配置保存完成的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_write_configuration_execute_frame","type":"era.tavern.frame.agent_write_configuration.execute","display_name":"等待角色生成配置保存完成的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_write_configuration_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待角色生成配置保存完成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_write_configuration_execute_frame":["保留“等待角色生成配置保存完成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/agent/context.ts","export":"AwaitConfiguration"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_write_configuration.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_write_configuration_start_operation = defineNode({
  "display_name": "将多阶段生成设置写入当前角色",
  "description": "接收完整生成配置，确认当前是可写入的角色卡且不是群聊，再发起角色设置保存。后续等待实际完成，使页面的配置修改得到明确结果。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_write_configuration.check_request","cardinality":"exactly_one","display_name":"将多阶段生成设置写入当前角色的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_write_configuration_start_operation_frame","type":"era.tavern.call.frame","display_name":"将多阶段生成设置写入当前角色的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_write_configuration_start_operation_frame"}},"input_semantics":{"era.tavern.frame.agent_write_configuration.check_request":["保留“将多阶段生成设置写入当前角色”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_write_configuration_start_operation_frame":["保留“将多阶段生成设置写入当前角色”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/context.ts","export":"StartConfiguration"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_write_configuration.start_operation",
  "node_type": "vibeflow.node"
});
