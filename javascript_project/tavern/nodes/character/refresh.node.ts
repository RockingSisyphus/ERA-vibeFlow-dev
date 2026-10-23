import {defineNode} from "@vibeflow/plugin";

export const era_tavern_character_apply_greeting_refresh_execute = defineNode({
  "display_name": "等待开场白接收通知处理完成",
  "description": "接收已经发出的首条消息接收通知，等待监听方处理完成。随后才重建聊天显示，使相关监听处理与呈现顺序一致。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待开场白接收通知处理完成的请求和已有进度"}],"provides":[{"key":"era_tavern_character_apply_greeting_refresh_execute_frame","type":"era.tavern.frame.character_apply_greeting_refresh.execute.raw","display_name":"等待开场白接收通知处理完成的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_apply_greeting_refresh_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待开场白接收通知处理完成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_apply_greeting_refresh_execute_frame":["保留“等待开场白接收通知处理完成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/character/refresh.ts","export":"AwaitReceived"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_apply_greeting_refresh.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_apply_greeting_refresh_start_operation = defineNode({
  "display_name": "更新聊天首条消息并发出接收通知",
  "description": "根据主服务已经选定的方案，在空聊天建立开场白，或更新已有首条消息及其原始回复。随后发出首条消息接收通知，后续等待通知、重绘并保存聊天。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_apply_greeting_refresh.check_request","cardinality":"exactly_one","display_name":"更新聊天首条消息并发出接收通知的请求和已有进度"}],"provides":[{"key":"era_tavern_character_apply_greeting_refresh_start_operation_frame","type":"era.tavern.call.frame","display_name":"更新聊天首条消息并发出接收通知的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_apply_greeting_refresh_start_operation_frame"}},"input_semantics":{"era.tavern.frame.character_apply_greeting_refresh.check_request":["保留“更新聊天首条消息并发出接收通知”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_apply_greeting_refresh_start_operation_frame":["保留“更新聊天首条消息并发出接收通知”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/character/refresh.ts","export":"StartRefresh"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_apply_greeting_refresh.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_apply_greeting_refresh_finish_clear_display = defineNode({
  "display_name": "清除旧聊天显示以便重绘开场白",
  "description": "当前首条消息已经更新后，清理聊天区域的旧显示。后续按现有消息重建页面，使新的开场白内容能够完整呈现。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_apply_greeting_refresh.execute.raw","cardinality":"exactly_one","display_name":"清除旧聊天显示以便重绘开场白的请求和已有进度"}],"provides":[{"key":"era_tavern_character_apply_greeting_refresh_finish_clear_display_frame","type":"era.tavern.frame.character_apply_greeting_refresh_finish.clear_display","display_name":"清除旧聊天显示以便重绘开场白的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_apply_greeting_refresh_finish_clear_display_frame"}},"input_semantics":{"era.tavern.frame.character_apply_greeting_refresh.execute.raw":["保留“清除旧聊天显示以便重绘开场白”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_apply_greeting_refresh_finish_clear_display_frame":["保留“清除旧聊天显示以便重绘开场白”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/character/refresh.ts","export":"ClearDisplay"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_apply_greeting_refresh_finish.clear_display",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_apply_greeting_refresh_finish_emit_rendered = defineNode({
  "display_name": "通知开场白已经显示完成",
  "description": "聊天重新绘制后，发出首条角色消息的呈现完成通知，等待相关处理结束。让依赖消息显示的功能知道新开场白已经可用。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_apply_greeting_refresh_finish.print_messages","cardinality":"exactly_one","display_name":"通知开场白已经显示完成的请求和已有进度"}],"provides":[{"key":"era_tavern_character_apply_greeting_refresh_finish_emit_rendered_frame","type":"era.tavern.frame.character_apply_greeting_refresh_finish.emit_rendered","display_name":"通知开场白已经显示完成的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_apply_greeting_refresh_finish_emit_rendered_frame"}},"input_semantics":{"era.tavern.frame.character_apply_greeting_refresh_finish.print_messages":["保留“通知开场白已经显示完成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_apply_greeting_refresh_finish_emit_rendered_frame":["保留“通知开场白已经显示完成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/character/refresh.ts","export":"EmitRendered"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_apply_greeting_refresh_finish.emit_rendered",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_apply_greeting_refresh_finish_print_messages = defineNode({
  "display_name": "重新绘制包含新开场白的聊天",
  "description": "旧显示清理完成后，按当前聊天消息重新绘制页面。新的首条消息由此出现，随后再发出显示完成通知并保存聊天。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_apply_greeting_refresh_finish.clear_display","cardinality":"exactly_one","display_name":"重新绘制包含新开场白的聊天的请求和已有进度"}],"provides":[{"key":"era_tavern_character_apply_greeting_refresh_finish_print_messages_frame","type":"era.tavern.frame.character_apply_greeting_refresh_finish.print_messages","display_name":"重新绘制包含新开场白的聊天的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_apply_greeting_refresh_finish_print_messages_frame"}},"input_semantics":{"era.tavern.frame.character_apply_greeting_refresh_finish.clear_display":["保留“重新绘制包含新开场白的聊天”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_apply_greeting_refresh_finish_print_messages_frame":["保留“重新绘制包含新开场白的聊天”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/character/refresh.ts","export":"PrintMessages"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_apply_greeting_refresh_finish.print_messages",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_apply_greeting_refresh_finish_save_chat = defineNode({
  "display_name": "保存已更新并重绘的开场白聊天",
  "description": "首条消息更新、接收通知和重绘完成后，保存当前聊天。返回刷新完成的确认，表示这次开场白同步已完成实际收尾。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_apply_greeting_refresh_finish.emit_rendered","cardinality":"exactly_one","display_name":"保存已更新并重绘的开场白聊天的请求和已有进度"}],"provides":[{"key":"era_tavern_character_apply_greeting_refresh_finish_save_chat_frame","type":"era.tavern.frame.character_apply_greeting_refresh.execute","display_name":"保存已更新并重绘的开场白聊天的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_apply_greeting_refresh_finish_save_chat_frame"}},"input_semantics":{"era.tavern.frame.character_apply_greeting_refresh_finish.emit_rendered":["保留“保存已更新并重绘的开场白聊天”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_apply_greeting_refresh_finish_save_chat_frame":["保留“保存已更新并重绘的开场白聊天”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/character/refresh.ts","export":"SaveChat"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_apply_greeting_refresh_finish.save_chat",
  "node_type": "vibeflow.node"
});
