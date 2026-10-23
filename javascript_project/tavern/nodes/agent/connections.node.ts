import {defineNode} from "@vibeflow/plugin";

export const era_tavern_agent_clear_connection_profile_key_execute = defineNode({
  "display_name": "等待本机连接设置保存完成（清除本机连接密钥）",
  "description": "本次处理“清除本机连接密钥”。接收已经发起的连接方案保存操作，等待实际保存结束。完成或失败后保留相应结果，供连接管理请求返回确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待本机连接设置保存完成（清除本机连接密钥）的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_clear_connection_profile_key_execute_frame","type":"era.tavern.frame.agent_clear_connection_profile_key.execute","display_name":"等待本机连接设置保存完成（清除本机连接密钥）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_clear_connection_profile_key_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待本机连接设置保存完成（清除本机连接密钥）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_clear_connection_profile_key_execute_frame":["保留“等待本机连接设置保存完成（清除本机连接密钥）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/agent/connections.ts","export":"AwaitSettings"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_clear_connection_profile_key.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_clear_connection_profile_key_start_operation = defineNode({
  "display_name": "清除指定连接的本机密钥",
  "description": "保留连接名称和地址，将其已保存密钥清空，并发起本机设置保存。后续等待保存完成，向调用方返回清除确认及不含密钥的连接摘要。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_clear_connection_profile_key.check_request","cardinality":"exactly_one","display_name":"清除指定连接的本机密钥的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_clear_connection_profile_key_start_operation_frame","type":"era.tavern.call.frame","display_name":"清除指定连接的本机密钥的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_clear_connection_profile_key_start_operation_frame"}},"input_semantics":{"era.tavern.frame.agent_clear_connection_profile_key.check_request":["保留“清除指定连接的本机密钥”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_clear_connection_profile_key_start_operation_frame":["保留“清除指定连接的本机密钥”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/connections.ts","export":"StartClearKey"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_clear_connection_profile_key.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_delete_connection_profile_execute = defineNode({
  "display_name": "等待本机连接设置保存完成（删除本机连接方案）",
  "description": "本次处理“删除本机连接方案”。接收已经发起的连接方案保存操作，等待实际保存结束。完成或失败后保留相应结果，供连接管理请求返回确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待本机连接设置保存完成（删除本机连接方案）的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_delete_connection_profile_execute_frame","type":"era.tavern.frame.agent_delete_connection_profile.execute","display_name":"等待本机连接设置保存完成（删除本机连接方案）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_delete_connection_profile_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待本机连接设置保存完成（删除本机连接方案）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_delete_connection_profile_execute_frame":["保留“等待本机连接设置保存完成（删除本机连接方案）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/agent/connections.ts","export":"AwaitSettings"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_delete_connection_profile.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_delete_connection_profile_start_operation = defineNode({
  "display_name": "删除本机连接方案并保存设置",
  "description": "按请求移除指定的本机模型连接方案，发起设置保存，并记下删除结果。后续等待保存完成，再向调用方确认这次操作。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_delete_connection_profile.check_request","cardinality":"exactly_one","display_name":"删除本机连接方案并保存设置的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_delete_connection_profile_start_operation_frame","type":"era.tavern.call.frame","display_name":"删除本机连接方案并保存设置的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_delete_connection_profile_start_operation_frame"}},"input_semantics":{"era.tavern.frame.agent_delete_connection_profile.check_request":["保留“删除本机连接方案并保存设置”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_delete_connection_profile_start_operation_frame":["保留“删除本机连接方案并保存设置”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/connections.ts","export":"StartDelete"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_delete_connection_profile.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_upsert_connection_profile_execute = defineNode({
  "display_name": "等待本机连接设置保存完成（保存本机连接方案）",
  "description": "本次处理“保存本机连接方案”。接收已经发起的连接方案保存操作，等待实际保存结束。完成或失败后保留相应结果，供连接管理请求返回确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待本机连接设置保存完成（保存本机连接方案）的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_upsert_connection_profile_execute_frame","type":"era.tavern.frame.agent_upsert_connection_profile.execute","display_name":"等待本机连接设置保存完成（保存本机连接方案）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_upsert_connection_profile_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待本机连接设置保存完成（保存本机连接方案）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_upsert_connection_profile_execute_frame":["保留“等待本机连接设置保存完成（保存本机连接方案）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/agent/connections.ts","export":"AwaitSettings"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_upsert_connection_profile.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_upsert_connection_profile_start_operation = defineNode({
  "display_name": "保存本机模型连接方案",
  "description": "读取连接名称、地址和本次密钥选择，新增或更新本机保存的模型连接，再发起设置保存。结果只保留可显示的连接摘要，实际保存完成由等待步骤确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_upsert_connection_profile.check_request","cardinality":"exactly_one","display_name":"保存本机模型连接方案的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_upsert_connection_profile_start_operation_frame","type":"era.tavern.call.frame","display_name":"保存本机模型连接方案的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_upsert_connection_profile_start_operation_frame"}},"input_semantics":{"era.tavern.frame.agent_upsert_connection_profile.check_request":["保留“保存本机模型连接方案”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_upsert_connection_profile_start_operation_frame":["保留“保存本机模型连接方案”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/connections.ts","export":"StartUpsert"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_upsert_connection_profile.start_operation",
  "node_type": "vibeflow.node"
});
