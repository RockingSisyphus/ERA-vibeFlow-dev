import {defineNode} from "@vibeflow/plugin";

export const era_tavern_agent_list_connection_models_execute = defineNode({
  "display_name": "等待模型列表查询的响应（查询已保存连接的模型）",
  "description": "本次处理“查询已保存连接的模型”。接收已经发起的连接查询，等待服务返回。请求失败时带回对应连接或草稿的可读原因，成功响应交给后续检查和模型名称整理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待模型列表查询的响应（查询已保存连接的模型）的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_list_connection_models_execute_frame","type":"era.tavern.frame.agent_list_connection_models.execute.raw","display_name":"等待模型列表查询的响应（查询已保存连接的模型）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_list_connection_models_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待模型列表查询的响应（查询已保存连接的模型）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_list_connection_models_execute_frame":["保留“等待模型列表查询的响应（查询已保存连接的模型）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/agent/models.ts","export":"AwaitStatus"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_list_connection_models.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_list_connection_models_start_operation = defineNode({
  "display_name": "向已保存连接查询可用模型",
  "description": "读取指定本机连接方案，使用它的地址和本机密钥发起模型列表查询。保留不含密钥的连接摘要，后续等待响应并整理模型名称。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_list_connection_models.check_request","cardinality":"exactly_one","display_name":"向已保存连接查询可用模型的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_list_connection_models_start_operation_frame","type":"era.tavern.call.frame","display_name":"向已保存连接查询可用模型的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_list_connection_models_start_operation_frame"}},"input_semantics":{"era.tavern.frame.agent_list_connection_models.check_request":["保留“向已保存连接查询可用模型”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_list_connection_models_start_operation_frame":["保留“向已保存连接查询可用模型”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/models.ts","export":"StartModels"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_list_connection_models.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_list_connection_models_draft_execute = defineNode({
  "display_name": "等待模型列表查询的响应（查询草稿连接的模型）",
  "description": "本次处理“查询草稿连接的模型”。接收已经发起的连接查询，等待服务返回。请求失败时带回对应连接或草稿的可读原因，成功响应交给后续检查和模型名称整理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待模型列表查询的响应（查询草稿连接的模型）的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_list_connection_models_draft_execute_frame","type":"era.tavern.frame.agent_list_connection_models_draft.execute.raw","display_name":"等待模型列表查询的响应（查询草稿连接的模型）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_list_connection_models_draft_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待模型列表查询的响应（查询草稿连接的模型）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_list_connection_models_draft_execute_frame":["保留“等待模型列表查询的响应（查询草稿连接的模型）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/agent/models.ts","export":"AwaitStatus"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_list_connection_models_draft.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_list_connection_models_draft_start_operation = defineNode({
  "display_name": "用未保存的连接草稿查询模型",
  "description": "读取本次连接草稿的地址和临时提供的密钥，发起可用模型查询。草稿无需先保存，后续将有效模型列表或具体失败原因返回设置界面。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_list_connection_models_draft.check_request","cardinality":"exactly_one","display_name":"用未保存的连接草稿查询模型的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_list_connection_models_draft_start_operation_frame","type":"era.tavern.call.frame","display_name":"用未保存的连接草稿查询模型的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_list_connection_models_draft_start_operation_frame"}},"input_semantics":{"era.tavern.frame.agent_list_connection_models_draft.check_request":["保留“用未保存的连接草稿查询模型”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_list_connection_models_draft_start_operation_frame":["保留“用未保存的连接草稿查询模型”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/models.ts","export":"StartDraftModels"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_list_connection_models_draft.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_list_connection_models_draft_finish_check_response = defineNode({
  "display_name": "确认模型列表查询成功响应（查询草稿连接的模型）",
  "description": "本次处理“查询草稿连接的模型”。检查模型服务对本次列表查询的响应是否成功。失败时返回具体连接查询原因，成功时继续读取返回内容，避免把错误页面当成模型列表。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_list_connection_models_draft.execute.raw","cardinality":"exactly_one","display_name":"确认模型列表查询成功响应（查询草稿连接的模型）的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_list_connection_models_draft_finish_check_response_frame","type":"era.tavern.frame.agent_list_connection_models_draft_finish.check_response","display_name":"确认模型列表查询成功响应（查询草稿连接的模型）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_list_connection_models_draft_finish_check_response_frame"}},"input_semantics":{"era.tavern.frame.agent_list_connection_models_draft.execute.raw":["保留“确认模型列表查询成功响应（查询草稿连接的模型）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_list_connection_models_draft_finish_check_response_frame":["保留“确认模型列表查询成功响应（查询草稿连接的模型）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/models.ts","export":"CheckResponse"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_list_connection_models_draft_finish.check_response",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_list_connection_models_draft_finish_project_models = defineNode({
  "display_name": "整理可供用户选择的模型名称（查询草稿连接的模型）",
  "description": "本次处理“查询草稿连接的模型”。从连接查询返回的数据中提取可用模型名称，整理成设置界面需要的列表。已保存连接还附上不含密钥的摘要，供用户确认列表来自哪个方案。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_list_connection_models_draft_finish.read_json","cardinality":"exactly_one","display_name":"整理可供用户选择的模型名称（查询草稿连接的模型）的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_list_connection_models_draft_finish_project_models_frame","type":"era.tavern.frame.agent_list_connection_models_draft.execute","display_name":"整理可供用户选择的模型名称（查询草稿连接的模型）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_list_connection_models_draft_finish_project_models_frame"}},"input_semantics":{"era.tavern.frame.agent_list_connection_models_draft_finish.read_json":["保留“整理可供用户选择的模型名称（查询草稿连接的模型）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_list_connection_models_draft_finish_project_models_frame":["保留“整理可供用户选择的模型名称（查询草稿连接的模型）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/models.ts","export":"ProjectModels"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_list_connection_models_draft_finish.project_models",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_list_connection_models_draft_finish_read_json = defineNode({
  "display_name": "读取模型查询返回的内容（查询草稿连接的模型）",
  "description": "本次处理“查询草稿连接的模型”。接收已经确认成功的模型列表响应，读取其中的数据。读取失败时报告查询问题，成功资料交给模型名称整理步骤。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_list_connection_models_draft_finish.check_response","cardinality":"exactly_one","display_name":"读取模型查询返回的内容（查询草稿连接的模型）的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_list_connection_models_draft_finish_read_json_frame","type":"era.tavern.frame.agent_list_connection_models_draft_finish.read_json","display_name":"读取模型查询返回的内容（查询草稿连接的模型）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_list_connection_models_draft_finish_read_json_frame"}},"input_semantics":{"era.tavern.frame.agent_list_connection_models_draft_finish.check_response":["保留“读取模型查询返回的内容（查询草稿连接的模型）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_list_connection_models_draft_finish_read_json_frame":["保留“读取模型查询返回的内容（查询草稿连接的模型）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/agent/models.ts","export":"ReadJson"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_list_connection_models_draft_finish.read_json",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_list_connection_models_finish_check_response = defineNode({
  "display_name": "确认模型列表查询成功响应（查询已保存连接的模型）",
  "description": "本次处理“查询已保存连接的模型”。检查模型服务对本次列表查询的响应是否成功。失败时返回具体连接查询原因，成功时继续读取返回内容，避免把错误页面当成模型列表。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_list_connection_models.execute.raw","cardinality":"exactly_one","display_name":"确认模型列表查询成功响应（查询已保存连接的模型）的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_list_connection_models_finish_check_response_frame","type":"era.tavern.frame.agent_list_connection_models_finish.check_response","display_name":"确认模型列表查询成功响应（查询已保存连接的模型）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_list_connection_models_finish_check_response_frame"}},"input_semantics":{"era.tavern.frame.agent_list_connection_models.execute.raw":["保留“确认模型列表查询成功响应（查询已保存连接的模型）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_list_connection_models_finish_check_response_frame":["保留“确认模型列表查询成功响应（查询已保存连接的模型）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/models.ts","export":"CheckResponse"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_list_connection_models_finish.check_response",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_list_connection_models_finish_project_models = defineNode({
  "display_name": "整理可供用户选择的模型名称（查询已保存连接的模型）",
  "description": "本次处理“查询已保存连接的模型”。从连接查询返回的数据中提取可用模型名称，整理成设置界面需要的列表。已保存连接还附上不含密钥的摘要，供用户确认列表来自哪个方案。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_list_connection_models_finish.read_json","cardinality":"exactly_one","display_name":"整理可供用户选择的模型名称（查询已保存连接的模型）的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_list_connection_models_finish_project_models_frame","type":"era.tavern.frame.agent_list_connection_models.execute","display_name":"整理可供用户选择的模型名称（查询已保存连接的模型）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_list_connection_models_finish_project_models_frame"}},"input_semantics":{"era.tavern.frame.agent_list_connection_models_finish.read_json":["保留“整理可供用户选择的模型名称（查询已保存连接的模型）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_list_connection_models_finish_project_models_frame":["保留“整理可供用户选择的模型名称（查询已保存连接的模型）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/models.ts","export":"ProjectModels"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_list_connection_models_finish.project_models",
  "node_type": "vibeflow.node"
});

export const era_tavern_agent_list_connection_models_finish_read_json = defineNode({
  "display_name": "读取模型查询返回的内容（查询已保存连接的模型）",
  "description": "本次处理“查询已保存连接的模型”。接收已经确认成功的模型列表响应，读取其中的数据。读取失败时报告查询问题，成功资料交给模型名称整理步骤。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.agent_list_connection_models_finish.check_response","cardinality":"exactly_one","display_name":"读取模型查询返回的内容（查询已保存连接的模型）的请求和已有进度"}],"provides":[{"key":"era_tavern_agent_list_connection_models_finish_read_json_frame","type":"era.tavern.frame.agent_list_connection_models_finish.read_json","display_name":"读取模型查询返回的内容（查询已保存连接的模型）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_agent_list_connection_models_finish_read_json_frame"}},"input_semantics":{"era.tavern.frame.agent_list_connection_models_finish.check_response":["保留“读取模型查询返回的内容（查询已保存连接的模型）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_agent_list_connection_models_finish_read_json_frame":["保留“读取模型查询返回的内容（查询已保存连接的模型）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/agent/models.ts","export":"ReadJson"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.agent_facts","era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.agent_list_connection_models_finish.read_json",
  "node_type": "vibeflow.node"
});
