import {defineNode} from "@vibeflow/plugin";

export const era_tavern_messages_update_content_check_target = defineNode({
  "display_name": "写消息前核对聊天和状态文件",
  "description": "检查当前实例、目标消息和预期的状态文件绑定仍与本次任务一致，记录本次保存依据和需要的刷新方式。后续据此准备消息修改，避免用户切换聊天后写错目标。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"写消息前核对聊天和状态文件的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_check_target_frame","type":"era.tavern.frame.messages_update_content.check_target","display_name":"写消息前核对聊天和状态文件的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_check_target_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“写消息前核对聊天和状态文件”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_check_target_frame":["保留“写消息前核对聊天和状态文件”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/prepare.ts","export":"CheckTarget"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content.check_target",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_update_content_choose_update = defineNode({
  "display_name": "区分单条正文修改和批量消息修改",
  "description": "接收消息写入请求，判断是直接替换一条正文，还是处理明确列出的多条消息更新。后续统一整理成一次批量提交所需的清单。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_update_content.check_target","cardinality":"exactly_one","display_name":"区分单条正文修改和批量消息修改的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_choose_update_frame","type":"era.tavern.frame.messages_update_content.choose_update","display_name":"区分单条正文修改和批量消息修改的处理进度及结果"},{"key":"era_tavern_messages_update_content_choose_update_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_choose_update_frame","route":"era_tavern_messages_update_content_choose_update_route"}},"input_semantics":{"era.tavern.frame.messages_update_content.check_target":["保留“区分单条正文修改和批量消息修改”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_choose_update_frame":["保留“区分单条正文修改和批量消息修改”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_messages_update_content_choose_update_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/prepare.ts","export":"ChooseUpdate"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content.choose_update",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_update_content_select_many = defineNode({
  "display_name": "接收明确列出的消息修改",
  "description": "复制请求指定的单项或多项消息更新，保留原顺序。后续逐项补齐应保留的消息附加资料，再统一发起写入。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_update_content.choose_update","cardinality":"exactly_one","display_name":"接收明确列出的消息修改的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_select_many_frame","type":"era.tavern.frame.messages_update_content.choose_update","display_name":"接收明确列出的消息修改的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_select_many_frame"}},"input_semantics":{"era.tavern.frame.messages_update_content.choose_update":["保留“接收明确列出的消息修改”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_select_many_frame":["保留“接收明确列出的消息修改”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/prepare.ts","export":"SelectMany"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content.select_many",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_update_content_select_single = defineNode({
  "display_name": "检查并整理一条消息的正文替换",
  "description": "读取消息编号和新正文，确认目标存在且文字有效，整理成一项更新。后续与批量修改共用同一写入和保存确认流程。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_update_content.choose_update","cardinality":"exactly_one","display_name":"检查并整理一条消息的正文替换的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_select_single_frame","type":"era.tavern.frame.messages_update_content.choose_update","display_name":"检查并整理一条消息的正文替换的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_select_single_frame"}},"input_semantics":{"era.tavern.frame.messages_update_content.choose_update":["保留“检查并整理一条消息的正文替换”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_select_single_frame":["保留“检查并整理一条消息的正文替换”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/prepare.ts","export":"SelectSingle"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content.select_single",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_update_content_start_operation = defineNode({
  "display_name": "再次核对目标并发起批量消息更新",
  "description": "准备清单完成后，再检查聊天消息及状态文件绑定仍一致，随后一次提交全部消息修改。后续等待真实更新并保存聊天，防止准备期间目标变化。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_update_content.choose_update","cardinality":"exactly_one","display_name":"再次核对目标并发起批量消息更新的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_start_operation_frame","type":"era.tavern.frame.messages_update_content.started","display_name":"再次核对目标并发起批量消息更新的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_start_operation_frame"}},"input_semantics":{"era.tavern.frame.messages_update_content.choose_update":["保留“再次核对目标并发起批量消息更新”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_start_operation_frame":["保留“再次核对目标并发起批量消息更新”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/prepare.ts","export":"StartWrite"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_update_content_update_messages_item_choose_item = defineNode({
  "display_name": "判断还有没有消息修改需要整理",
  "description": "查看本次消息更新清单的当前位置。还有项目时整理下一条，全部完成时结束准备，后续一次提交整份修改清单。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_update_content.choose_update","cardinality":"exactly_one","display_name":"判断还有没有消息修改需要整理的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_update_messages_item_choose_item_frame","type":"era.tavern.frame.messages_update_content.choose_update","display_name":"判断还有没有消息修改需要整理的处理进度及结果"},{"key":"era_tavern_messages_update_content_update_messages_item_choose_item_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_update_messages_item_choose_item_frame","route":"era_tavern_messages_update_content_update_messages_item_choose_item_route"}},"input_semantics":{"era.tavern.frame.messages_update_content.choose_update":["保留“判断还有没有消息修改需要整理”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_update_messages_item_choose_item_frame":["保留“判断还有没有消息修改需要整理”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_messages_update_content_update_messages_item_choose_item_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/prepare.ts","export":"ChooseItem"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content_update_messages_item.choose_item",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_update_content_update_messages_item_empty = defineNode({
  "display_name": "确认消息更新清单已经整理完",
  "description": "全部消息修改已经遍历时，标记准备循环结束。后续使用整理好的清单一次发起写入，而不是在此逐条保存。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_update_content.choose_update","cardinality":"exactly_one","display_name":"确认消息更新清单已经整理完的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_update_messages_item_empty_frame","type":"era.tavern.frame.messages_update_content.choose_update","display_name":"确认消息更新清单已经整理完的处理进度及结果"},{"key":"era_tavern_messages_update_content_update_messages_item_empty_done","type":"era.tavern.done.messages_update_content.update_messages","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_update_messages_item_empty_frame","done":"era_tavern_messages_update_content_update_messages_item_empty_done"}},"input_semantics":{"era.tavern.frame.messages_update_content.choose_update":["保留“确认消息更新清单已经整理完”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_update_messages_item_empty_frame":["保留“确认消息更新清单已经整理完”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_messages_update_content_update_messages_item_empty_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/prepare.ts","export":"EmptyItem"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content_update_messages_item.empty",
  "node_type": "vibeflow.node"
});

export const era_tavern_messages_update_content_update_messages_item_one_item = defineNode({
  "display_name": "整理一条修改并保留原附加资料",
  "description": "取出一条消息修改：候选数组中的正文按全候选视图定位，附加字段从当前候选视图读取并与本次 ERA 字段合并，保留原有资料。记录受影响消息和 ERA 写入的文字，交给后续统一提交。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.messages_update_content.choose_update","cardinality":"exactly_one","display_name":"整理一条修改并保留原附加资料的请求和已有进度"}],"provides":[{"key":"era_tavern_messages_update_content_update_messages_item_one_item_frame","type":"era.tavern.frame.messages_update_content.choose_update","display_name":"整理一条修改并保留原附加资料的处理进度及结果"},{"key":"era_tavern_messages_update_content_update_messages_item_one_item_done","type":"era.tavern.done.messages_update_content.update_messages","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_messages_update_content_update_messages_item_one_item_frame","done":"era_tavern_messages_update_content_update_messages_item_one_item_done"}},"input_semantics":{"era.tavern.frame.messages_update_content.choose_update":["保留“整理一条修改并保留原附加资料”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_messages_update_content_update_messages_item_one_item_frame":["保留“整理一条修改并保留原附加资料”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_messages_update_content_update_messages_item_one_item_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/messages/prepare.ts","export":"PrepareItem"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources"],
  "id": "era.tavern.messages_update_content_update_messages_item.one_item",
  "node_type": "vibeflow.node"
});
