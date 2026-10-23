import {defineNode} from "@vibeflow/plugin";

export const era_tavern_regex_read_execute = defineNode({
  "display_name": "读取角色正则规则及启用状态",
  "description": "读取当前角色的正则清单和开关，返回给资源规划。初始化据此判断状态栏显示规则是否已安装、是否需要补齐。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.regex_read.check_request","cardinality":"exactly_one","display_name":"读取角色正则规则及启用状态的请求和已有进度"}],"provides":[{"key":"era_tavern_regex_read_execute_frame","type":"era.tavern.frame.regex_read.execute","display_name":"读取角色正则规则及启用状态的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_regex_read_execute_frame"}},"input_semantics":{"era.tavern.frame.regex_read.check_request":["保留“读取角色正则规则及启用状态”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_regex_read_execute_frame":["保留“读取角色正则规则及启用状态”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/regex.ts","export":"ReadRegex"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.regex_read.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_regex_upsert_execute = defineNode({
  "display_name": "等待角色正则规则写入完成",
  "description": "接收已发起的角色正则保存，等待实际结束。后续检查启用状态，确保新规则能够在当前角色生效。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待角色正则规则写入完成的请求和已有进度"}],"provides":[{"key":"era_tavern_regex_upsert_execute_frame","type":"era.tavern.frame.regex_upsert.execute.raw","display_name":"等待角色正则规则写入完成的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_regex_upsert_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待角色正则规则写入完成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_regex_upsert_execute_frame":["保留“等待角色正则规则写入完成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/regex.ts","export":"AwaitField"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.regex_upsert.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_regex_upsert_start_operation = defineNode({
  "display_name": "把指定正则加入角色规则并保存",
  "description": "接收明确正则规则，附到当前角色已有清单，确认角色可写后发起保存。后续等待完成，再检查是否需要启用角色正则并刷新聊天。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.regex_upsert.check_request","cardinality":"exactly_one","display_name":"把指定正则加入角色规则并保存的请求和已有进度"}],"provides":[{"key":"era_tavern_regex_upsert_start_operation_frame","type":"era.tavern.call.frame","display_name":"把指定正则加入角色规则并保存的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_regex_upsert_start_operation_frame"}},"input_semantics":{"era.tavern.frame.regex_upsert.check_request":["保留“把指定正则加入角色规则并保存”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_regex_upsert_start_operation_frame":["保留“把指定正则加入角色规则并保存”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/regex.ts","export":"StartUpsert"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.regex_upsert.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_regex_upsert_finish_choose_enabled = defineNode({
  "display_name": "判断角色正则是否还需要开启",
  "description": "检查当前角色正则已否启用。已开启则沿用，尚未开启则进入设置保存，之后统一重新加载聊天使规则生效。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.regex_upsert.execute.raw","cardinality":"exactly_one","display_name":"判断角色正则是否还需要开启的请求和已有进度"}],"provides":[{"key":"era_tavern_regex_upsert_finish_choose_enabled_frame","type":"era.tavern.frame.regex_upsert_finish.choose_enabled","display_name":"判断角色正则是否还需要开启的处理进度及结果"},{"key":"era_tavern_regex_upsert_finish_choose_enabled_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_regex_upsert_finish_choose_enabled_frame","route":"era_tavern_regex_upsert_finish_choose_enabled_route"}},"input_semantics":{"era.tavern.frame.regex_upsert.execute.raw":["保留“判断角色正则是否还需要开启”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_regex_upsert_finish_choose_enabled_frame":["保留“判断角色正则是否还需要开启”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_regex_upsert_finish_choose_enabled_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/regex.ts","export":"ChooseEnabled"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.regex_upsert_finish.choose_enabled",
  "node_type": "vibeflow.node"
});

export const era_tavern_regex_upsert_finish_enable_and_save = defineNode({
  "display_name": "启用当前角色正则并保存开关",
  "description": "将当前角色加入允许使用局部正则的名单，等待设置保存。后续重新加载聊天，使刚写入的状态栏等规则生效。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.regex_upsert_finish.choose_enabled","cardinality":"exactly_one","display_name":"启用当前角色正则并保存开关的请求和已有进度"}],"provides":[{"key":"era_tavern_regex_upsert_finish_enable_and_save_frame","type":"era.tavern.frame.regex_upsert_finish.enable_and_save","display_name":"启用当前角色正则并保存开关的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_regex_upsert_finish_enable_and_save_frame"}},"input_semantics":{"era.tavern.frame.regex_upsert_finish.choose_enabled":["保留“启用当前角色正则并保存开关”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_regex_upsert_finish_enable_and_save_frame":["保留“启用当前角色正则并保存开关”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/regex.ts","export":"EnableAndSave"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.regex_upsert_finish.enable_and_save",
  "node_type": "vibeflow.node"
});

export const era_tavern_regex_upsert_finish_reload_chat = defineNode({
  "display_name": "重新加载聊天使角色正则生效",
  "description": "角色正则规则和启用设置已准备后，重新加载当前聊天。返回规则数量及启用确认，供资源初始化记录完成情况。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.regex_upsert_finish.enable_and_save","cardinality":"all","display_name":"重新加载聊天使角色正则生效的请求和已有进度"}],"provides":[{"key":"era_tavern_regex_upsert_finish_reload_chat_frame","type":"era.tavern.frame.regex_upsert.execute","display_name":"重新加载聊天使角色正则生效的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_regex_upsert_finish_reload_chat_frame"}},"input_semantics":{"era.tavern.frame.regex_upsert_finish.enable_and_save":["保留“重新加载聊天使角色正则生效”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_regex_upsert_finish_reload_chat_frame":["保留“重新加载聊天使角色正则生效”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/regex.ts","export":"ReloadChat"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.regex_upsert_finish.reload_chat",
  "node_type": "vibeflow.node"
});
