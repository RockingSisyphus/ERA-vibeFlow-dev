import {defineNode} from "@vibeflow/plugin";

export const era_tavern_messages_refresh_check_basis = defineNode({
  "display_name": "刷新前确认消息来源仍有效",
  "description": "检查当前实例和取消状态，必要时确认目标消息仍与本次操作依据一致。通过后才刷新显示，避免过期任务刷新新的聊天内容。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"刷新前确认消息来源仍有效的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_refresh_check_basis_frame","type":"era.tavern.frame.messages_refresh.check_basis","display_name":"刷新前确认消息来源仍有效的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_refresh_check_basis_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“刷新前确认消息来源仍有效”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_refresh_check_basis_frame":["保留“刷新前确认消息来源仍有效”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/refresh.ts","export":"CheckBasis"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_refresh.check_basis",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_refresh_choose_refresh = defineNode({
  "display_name": "选择刷新整段聊天还是一条消息",
  "description": "读取请求的显示刷新范围，选择整个当前聊天或指定消息。后续据此调用对应呈现方式，保持刷新范围明确。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_refresh.check_basis","cardinality":"exactly_one","display_name":"选择刷新整段聊天还是一条消息的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_refresh_choose_refresh_frame","type":"era.tavern.frame.messages_refresh.choose_refresh","display_name":"选择刷新整段聊天还是一条消息的处理进度及结果"},{"key":"era_tavern_messages_refresh_choose_refresh_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_refresh_choose_refresh_frame","route":"era_tavern_messages_refresh_choose_refresh_route"}},"input_semantics":{"era.tavern.frame.messages_refresh.check_basis":["保留“选择刷新整段聊天还是一条消息”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_refresh_choose_refresh_frame":["保留“选择刷新整段聊天还是一条消息”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_messages_refresh_choose_refresh_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/refresh.ts","export":"ChooseRefresh"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_refresh.choose_refresh",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_refresh_refresh = defineNode({
  "display_name": "等待消息显示刷新完成",
  "description": "接收已经发起的显示刷新，等待其实际结束后返回完成确认。主服务据此结束本次呈现请求。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待消息显示刷新完成的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_refresh_refresh_frame","type":"era.tavern.frame.messages_refresh.refresh","display_name":"等待消息显示刷新完成的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_refresh_refresh_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待消息显示刷新完成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_refresh_refresh_frame":["保留“等待消息显示刷新完成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/messages/refresh.ts","export":"AwaitRefresh"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_refresh.refresh",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_refresh_select_all = defineNode({
  "display_name": "确定刷新整个当前聊天",
  "description": "接收整聊天刷新要求，记录本次使用完整聊天重绘。后续向酒馆发起对应刷新操作。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_refresh.choose_refresh","cardinality":"exactly_one","display_name":"确定刷新整个当前聊天的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_refresh_select_all_frame","type":"era.tavern.frame.messages_refresh.choose_refresh","display_name":"确定刷新整个当前聊天的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_refresh_select_all_frame"}},"input_semantics":{"era.tavern.frame.messages_refresh.choose_refresh":["保留“确定刷新整个当前聊天”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_refresh_select_all_frame":["保留“确定刷新整个当前聊天”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/refresh.ts","export":"SelectAll"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_refresh.select_all",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_refresh_select_one = defineNode({
  "display_name": "确定需要刷新的单条消息",
  "description": "读取并检查目标消息编号，记录本次只刷新这一条。后续向酒馆发起单消息显示更新。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_refresh.choose_refresh","cardinality":"exactly_one","display_name":"确定需要刷新的单条消息的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_refresh_select_one_frame","type":"era.tavern.frame.messages_refresh.choose_refresh","display_name":"确定需要刷新的单条消息的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_refresh_select_one_frame"}},"input_semantics":{"era.tavern.frame.messages_refresh.choose_refresh":["保留“确定需要刷新的单条消息”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_refresh_select_one_frame":["保留“确定需要刷新的单条消息”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/refresh.ts","export":"SelectOne"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_refresh.select_one",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_refresh_start_operation = defineNode({
  "display_name": "发起所选范围的消息显示刷新",
  "description": "根据已选择的单条或全聊天范围，向酒馆发起消息重绘。后续等待真实完成，供同步流程确认页面呈现已处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_refresh.choose_refresh","cardinality":"exactly_one","display_name":"发起所选范围的消息显示刷新的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_refresh_start_operation_frame","type":"era.tavern.frame.messages_refresh.started","display_name":"发起所选范围的消息显示刷新的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_refresh_start_operation_frame"}},"input_semantics":{"era.tavern.frame.messages_refresh.choose_refresh":["保留“发起所选范围的消息显示刷新”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_refresh_start_operation_frame":["保留“发起所选范围的消息显示刷新”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/refresh.ts","export":"StartRefresh"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_refresh.start_operation",
  "node_type": "vibeflow.node"
});
