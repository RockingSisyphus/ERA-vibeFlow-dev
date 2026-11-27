import {defineNode} from "@vibeflow/plugin";

export const era_tavern_messages_update_content_await_persistence = defineNode({
  "display_name": "确认仍在原聊天后保存消息",
  "description": "消息更新完成后，检查仍是原目标聊天并等待聊天保存。没有实际正文变化时直接完成；保存或聊天切换出错时记下原因，供后续准确返回写入状态。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_update_content.update_messages","cardinality":"exactly_one","display_name":"确认仍在原聊天后保存消息的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_await_persistence_frame","type":"era.tavern.frame.messages_update_content.await_persistence.raw","display_name":"确认仍在原聊天后保存消息的处理进度及结果"},{"key":"era_tavern_messages_update_content_await_persistence_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_await_persistence_frame","route":"era_tavern_messages_update_content_await_persistence_route"}},"input_semantics":{"era.tavern.frame.messages_update_content.update_messages":["保留“确认仍在原聊天后保存消息”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_await_persistence_frame":["保留“确认仍在原聊天后保存消息”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_messages_update_content_await_persistence_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/messages/finish.ts","export":"SaveChat"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content.await_persistence",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_update_content_project_display = defineNode({
  "display_name": "按真实保存结果更新消息显示",
  "description": "消息保存且原聊天和楼层仍匹配时，只将受影响楼号交给 ERA 报告模块。保存失败时返回内存写入、落盘确认和来源变化信息，供主服务决定恢复方式。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_update_content.await_persistence","cardinality":"all","display_name":"按真实保存结果更新消息显示的请求和已有进度"},{"type":"era.tavern.frame.messages_update_content.await_persistence.raw","cardinality":"all","display_name":"按真实保存结果更新消息显示的请求和已有进度"},{"type":"era.tavern.frame.messages_update_content_finish.read_saved_chat","cardinality":"all","display_name":"按真实保存结果更新消息显示的请求和已有进度"},{"type":"era.tavern.frame.messages_update_content_finish.read_saved_json","cardinality":"all","display_name":"按真实保存结果更新消息显示的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_project_display_frame","type":"era.tavern.call.frame","display_name":"按真实保存结果更新消息显示的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_project_display_frame"}},"input_semantics":{"era.tavern.frame.messages_update_content.await_persistence":["保留“按真实保存结果更新消息显示”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"],"era.tavern.frame.messages_update_content.await_persistence.raw":["保留“按真实保存结果更新消息显示”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"],"era.tavern.frame.messages_update_content_finish.read_saved_chat":["保留“按真实保存结果更新消息显示”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"],"era.tavern.frame.messages_update_content_finish.read_saved_json":["保留“按真实保存结果更新消息显示”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_project_display_frame":["保留“按真实保存结果更新消息显示”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/finish.ts","export":"ProjectDisplay"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content.project_display",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_update_content_update_messages = defineNode({
  "display_name": "等待批量消息更新操作完成",
  "description": "接收已经发起的消息更新，等待酒馆实际处理结束。随后进入聊天保存与回读确认，使调用方能区分内存更新和真正保存。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待批量消息更新操作完成的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_update_messages_frame","type":"era.tavern.frame.messages_update_content.update_messages","display_name":"等待批量消息更新操作完成的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_update_messages_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待批量消息更新操作完成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_update_messages_frame":["保留“等待批量消息更新操作完成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/messages/finish.ts","export":"AwaitWrite"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content.update_messages",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_update_content_finish_check_saved_messages = defineNode({
  "display_name": "确认已保存消息与本次修改一致",
  "description": "将重新读取的聊天内容与应保存文字比较，并核对写入后的消息来源仍适用。记录保存已确认或实际问题，供后续返回准确结果。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_update_content_finish.read_saved_json","cardinality":"exactly_one","display_name":"确认已保存消息与本次修改一致的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_finish_check_saved_messages_frame","type":"era.tavern.frame.messages_update_content.await_persistence","display_name":"确认已保存消息与本次修改一致的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_finish_check_saved_messages_frame"}},"input_semantics":{"era.tavern.frame.messages_update_content_finish.read_saved_json":["保留“确认已保存消息与本次修改一致”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_finish_check_saved_messages_frame":["保留“确认已保存消息与本次修改一致”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/finish.ts","export":"CheckSavedMessages"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content_finish.check_saved_messages",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_update_content_finish_read_saved_chat = defineNode({
  "display_name": "重新读取刚保存的原聊天文件",
  "description": "接收本次保存依据，向酒馆读取原目标聊天文件，检查读取是否成功。后续将保存后的内容与应写入消息比较，确认不是只改了页面内存。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_update_content.await_persistence.raw","cardinality":"exactly_one","display_name":"重新读取刚保存的原聊天文件的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_finish_read_saved_chat_frame","type":"era.tavern.frame.messages_update_content_finish.read_saved_chat","display_name":"重新读取刚保存的原聊天文件的处理进度及结果"},{"key":"era_tavern_messages_update_content_finish_read_saved_chat_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_finish_read_saved_chat_frame","route":"era_tavern_messages_update_content_finish_read_saved_chat_route"}},"input_semantics":{"era.tavern.frame.messages_update_content.await_persistence.raw":["保留“重新读取刚保存的原聊天文件”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_finish_read_saved_chat_frame":["保留“重新读取刚保存的原聊天文件”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_messages_update_content_finish_read_saved_chat_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/messages/finish.ts","export":"ReadSavedChat"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content_finish.read_saved_chat",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_update_content_finish_read_saved_json = defineNode({
  "display_name": "读取保存回查中的消息内容",
  "description": "接收原聊天文件的读取响应，解析保存下来的消息列表。解析失败时保留原因，成功后交给内容比较步骤确认本次保存。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_update_content_finish.read_saved_chat","cardinality":"exactly_one","display_name":"读取保存回查中的消息内容的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_finish_read_saved_json_frame","type":"era.tavern.frame.messages_update_content_finish.read_saved_json","display_name":"读取保存回查中的消息内容的处理进度及结果"},{"key":"era_tavern_messages_update_content_finish_read_saved_json_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_finish_read_saved_json_frame","route":"era_tavern_messages_update_content_finish_read_saved_json_route"}},"input_semantics":{"era.tavern.frame.messages_update_content_finish.read_saved_chat":["保留“读取保存回查中的消息内容”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_finish_read_saved_json_frame":["保留“读取保存回查中的消息内容”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_messages_update_content_finish_read_saved_json_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/messages/finish.ts","export":"ReadSavedJson"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content_finish.read_saved_json",
  "node_type": "vibeflow.node"
});
