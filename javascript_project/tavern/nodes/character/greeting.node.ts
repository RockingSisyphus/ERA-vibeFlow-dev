import {defineNode} from "@vibeflow/plugin";

export const era_tavern_character_read_greeting_refresh_context_execute = defineNode({
  "display_name": "读取首条消息是否适合更新开场白",
  "description": "读取当前是否群聊、聊天是否有改动、消息数量及首条消息的原文和所选回复。主服务据此决定更新、新建还是保留当前首条消息。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_read_greeting_refresh_context.check_request","cardinality":"exactly_one","display_name":"读取首条消息是否适合更新开场白的请求和已有进度"}],"provides":[{"key":"era_tavern_character_read_greeting_refresh_context_execute_frame","type":"era.tavern.frame.character_read_greeting_refresh_context.execute","display_name":"读取首条消息是否适合更新开场白的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_read_greeting_refresh_context_execute_frame"}},"input_semantics":{"era.tavern.frame.character_read_greeting_refresh_context.check_request":["保留“读取首条消息是否适合更新开场白”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_read_greeting_refresh_context_execute_frame":["保留“读取首条消息是否适合更新开场白”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/character/greeting.ts","export":"ReadRefreshContext"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_read_greeting_refresh_context.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_read_main_greeting_execute = defineNode({
  "display_name": "返回角色主开场白和状态栏配置",
  "description": "等待读取角色资料的操作完成，取出主开场白、角色身份及外置状态栏设置。没有可用单角色时返回缺失说明，供初始化决定如何处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"返回角色主开场白和状态栏配置的请求和已有进度"}],"provides":[{"key":"era_tavern_character_read_main_greeting_execute_frame","type":"era.tavern.frame.character_read_main_greeting.execute","display_name":"返回角色主开场白和状态栏配置的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_read_main_greeting_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“返回角色主开场白和状态栏配置”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_read_main_greeting_execute_frame":["保留“返回角色主开场白和状态栏配置”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/character/greeting.ts","export":"ReadGreeting"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_read_main_greeting.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_read_main_greeting_start_operation = defineNode({
  "display_name": "发起读取当前角色的主开场白",
  "description": "识别当前角色，发起角色资料读取。群聊或没有角色时记录不可用情况，后续将主开场白和相关状态栏设置交回资源准备流程。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_read_main_greeting.check_request","cardinality":"exactly_one","display_name":"发起读取当前角色的主开场白的请求和已有进度"}],"provides":[{"key":"era_tavern_character_read_main_greeting_start_operation_frame","type":"era.tavern.call.frame","display_name":"发起读取当前角色的主开场白的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_read_main_greeting_start_operation_frame"}},"input_semantics":{"era.tavern.frame.character_read_main_greeting.check_request":["保留“发起读取当前角色的主开场白”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_read_main_greeting_start_operation_frame":["保留“发起读取当前角色的主开场白”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/character/greeting.ts","export":"StartRead"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_read_main_greeting.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_write_main_greeting_execute = defineNode({
  "display_name": "等待读取待修改角色的最新资料",
  "description": "接收开场白写入前已经发起的角色读取，等待最新资料返回。交给下一步检查原开场白是否仍符合本次修改依据。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待读取待修改角色的最新资料的请求和已有进度"}],"provides":[{"key":"era_tavern_character_write_main_greeting_execute_frame","type":"era.tavern.frame.character_write_main_greeting.execute.raw","display_name":"等待读取待修改角色的最新资料的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_write_main_greeting_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待读取待修改角色的最新资料”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_write_main_greeting_execute_frame":["保留“等待读取待修改角色的最新资料”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/character/greeting.ts","export":"AwaitCharacter"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_write_main_greeting.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_write_main_greeting_start_operation = defineNode({
  "display_name": "写入前重新读取角色主开场白",
  "description": "接收预期旧开场白和新文字，确认当前存在可写的单角色，再发起角色资料读取。后续先核对旧内容是否仍一致，避免初始化覆盖期间发生的新编辑。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_write_main_greeting.check_request","cardinality":"exactly_one","display_name":"写入前重新读取角色主开场白的请求和已有进度"}],"provides":[{"key":"era_tavern_character_write_main_greeting_start_operation_frame","type":"era.tavern.call.frame","display_name":"写入前重新读取角色主开场白的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_write_main_greeting_start_operation_frame"}},"input_semantics":{"era.tavern.frame.character_write_main_greeting.check_request":["保留“写入前重新读取角色主开场白”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_write_main_greeting_start_operation_frame":["保留“写入前重新读取角色主开场白”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/character/greeting.ts","export":"StartWrite"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_write_main_greeting.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_write_main_greeting_finish_check_expected = defineNode({
  "display_name": "确认开场白没有被其他编辑改变",
  "description": "将刚读取的主开场白与本次请求记住的旧文字比较。相同才继续保存新开场白，不同则报告内容已变化，防止覆盖新的作者编辑。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_write_main_greeting.execute.raw","cardinality":"exactly_one","display_name":"确认开场白没有被其他编辑改变的请求和已有进度"}],"provides":[{"key":"era_tavern_character_write_main_greeting_finish_check_expected_frame","type":"era.tavern.frame.character_write_main_greeting_finish.check_expected","display_name":"确认开场白没有被其他编辑改变的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_write_main_greeting_finish_check_expected_frame"}},"input_semantics":{"era.tavern.frame.character_write_main_greeting.execute.raw":["保留“确认开场白没有被其他编辑改变”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_write_main_greeting_finish_check_expected_frame":["保留“确认开场白没有被其他编辑改变”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/character/greeting.ts","export":"CheckExpected"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_write_main_greeting_finish.check_expected",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_write_main_greeting_finish_check_response = defineNode({
  "display_name": "确认主开场白保存成功",
  "description": "检查角色卡主开场白写入的响应，失败时返回保存原因。成功后再更新页面中持有的开场白，使显示与保存状态一致。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_write_main_greeting_finish.persist_greeting","cardinality":"exactly_one","display_name":"确认主开场白保存成功的请求和已有进度"}],"provides":[{"key":"era_tavern_character_write_main_greeting_finish_check_response_frame","type":"era.tavern.frame.character_write_main_greeting_finish.check_response","display_name":"确认主开场白保存成功的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_write_main_greeting_finish_check_response_frame"}},"input_semantics":{"era.tavern.frame.character_write_main_greeting_finish.persist_greeting":["保留“确认主开场白保存成功”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_write_main_greeting_finish_check_response_frame":["保留“确认主开场白保存成功”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/character/greeting.ts","export":"CheckResponse"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_write_main_greeting_finish.check_response",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_write_main_greeting_finish_persist_greeting = defineNode({
  "display_name": "将新的主开场白保存到角色卡",
  "description": "在写入依据确认后，向当前角色卡保存新主开场白，等待写入响应。保留实际目标供后续检查与页面资料同步。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_write_main_greeting_finish.check_expected","cardinality":"exactly_one","display_name":"将新的主开场白保存到角色卡的请求和已有进度"}],"provides":[{"key":"era_tavern_character_write_main_greeting_finish_persist_greeting_frame","type":"era.tavern.frame.character_write_main_greeting_finish.persist_greeting","display_name":"将新的主开场白保存到角色卡的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_write_main_greeting_finish_persist_greeting_frame"}},"input_semantics":{"era.tavern.frame.character_write_main_greeting_finish.check_expected":["保留“将新的主开场白保存到角色卡”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_write_main_greeting_finish_persist_greeting_frame":["保留“将新的主开场白保存到角色卡”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/character/greeting.ts","export":"PersistGreeting"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_write_main_greeting_finish.persist_greeting",
  "node_type": "vibeflow.node"
});

export const era_tavern_character_write_main_greeting_finish_publish_mirror = defineNode({
  "display_name": "同步页面中的已保存主开场白",
  "description": "角色卡保存成功后，更新当前页面持有的角色资料和开场白编辑框，返回新文字。完成资源写入的页面侧确认，聊天首条消息是否更新仍由相应流程决定。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.character_write_main_greeting_finish.check_response","cardinality":"exactly_one","display_name":"同步页面中的已保存主开场白的请求和已有进度"}],"provides":[{"key":"era_tavern_character_write_main_greeting_finish_publish_mirror_frame","type":"era.tavern.frame.character_write_main_greeting.execute","display_name":"同步页面中的已保存主开场白的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_character_write_main_greeting_finish_publish_mirror_frame"}},"input_semantics":{"era.tavern.frame.character_write_main_greeting_finish.check_response":["保留“同步页面中的已保存主开场白”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_character_write_main_greeting_finish_publish_mirror_frame":["保留“同步页面中的已保存主开场白”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/character/greeting.ts","export":"PublishGreeting"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.character_write_main_greeting_finish.publish_mirror",
  "node_type": "vibeflow.node"
});
