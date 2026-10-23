import {defineNode} from "@vibeflow/plugin";

export const era_tavern_worldbook_bind_execute = defineNode({
  "display_name": "等待角色的世界书绑定保存",
  "description": "接收已经发起的主世界书绑定，等待酒馆实际保存结束。成功后进入界面确认，失败原因交回资源流程。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待角色的世界书绑定保存的请求和已有进度"}],"provides":[{"key":"era_tavern_worldbook_bind_execute_frame","type":"era.tavern.frame.worldbook_bind.execute.raw","display_name":"等待角色的世界书绑定保存的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_worldbook_bind_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待角色的世界书绑定保存”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_worldbook_bind_execute_frame":["保留“等待角色的世界书绑定保存”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/worldbook.ts","export":"BindWorldbook"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.worldbook_bind.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_worldbook_bind_start_operation = defineNode({
  "display_name": "将世界书绑定到当前角色",
  "description": "检查世界书名称和当前角色，发起角色主世界书绑定保存。后续等待实际完成，再同步界面上的绑定显示。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.worldbook_bind.check_request","cardinality":"exactly_one","display_name":"将世界书绑定到当前角色的请求和已有进度"}],"provides":[{"key":"era_tavern_worldbook_bind_start_operation_frame","type":"era.tavern.call.frame","display_name":"将世界书绑定到当前角色的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_worldbook_bind_start_operation_frame"}},"input_semantics":{"era.tavern.frame.worldbook_bind.check_request":["保留“将世界书绑定到当前角色”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_worldbook_bind_start_operation_frame":["保留“将世界书绑定到当前角色”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/worldbook.ts","export":"StartBind"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.worldbook_bind.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_worldbook_bind_finish_read_back = defineNode({
  "display_name": "更新世界书选择显示并返回确认",
  "description": "角色绑定保存完成后，将页面世界书选择框更新为本次名称，返回绑定完成。使界面与刚保存的角色资源一致。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.worldbook_bind.execute.raw","cardinality":"exactly_one","display_name":"更新世界书选择显示并返回确认的请求和已有进度"}],"provides":[{"key":"era_tavern_worldbook_bind_finish_read_back_frame","type":"era.tavern.frame.worldbook_bind.execute","display_name":"更新世界书选择显示并返回确认的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_worldbook_bind_finish_read_back_frame"}},"input_semantics":{"era.tavern.frame.worldbook_bind.execute.raw":["保留“更新世界书选择显示并返回确认”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_worldbook_bind_finish_read_back_frame":["保留“更新世界书选择显示并返回确认”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/worldbook.ts","export":"ConfirmBinding"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.worldbook_bind_finish.read_back",
  "node_type": "vibeflow.node"
});

export const era_tavern_worldbook_create_execute = defineNode({
  "display_name": "确认世界书创建或已经存在",
  "description": "等待世界书创建操作完成，按真实结果返回已创建或已存在及名称。后续资源流程据此写入所需条目。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"确认世界书创建或已经存在的请求和已有进度"}],"provides":[{"key":"era_tavern_worldbook_create_execute_frame","type":"era.tavern.frame.worldbook_create.execute","display_name":"确认世界书创建或已经存在的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_worldbook_create_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“确认世界书创建或已经存在”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_worldbook_create_execute_frame":["保留“确认世界书创建或已经存在”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/worldbook.ts","export":"CreateWorldbook"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.worldbook_create.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_worldbook_create_start_operation = defineNode({
  "display_name": "按指定名称发起世界书创建",
  "description": "确认请求给出有效名称，向酒馆创建相应世界书。后续等待结果并区分新建成功或原本已存在。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.worldbook_create.check_request","cardinality":"exactly_one","display_name":"按指定名称发起世界书创建的请求和已有进度"}],"provides":[{"key":"era_tavern_worldbook_create_start_operation_frame","type":"era.tavern.call.frame","display_name":"按指定名称发起世界书创建的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_worldbook_create_start_operation_frame"}},"input_semantics":{"era.tavern.frame.worldbook_create.check_request":["保留“按指定名称发起世界书创建”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_worldbook_create_start_operation_frame":["保留“按指定名称发起世界书创建”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/worldbook.ts","export":"StartCreate"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.worldbook_create.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_worldbook_read_execute = defineNode({
  "display_name": "返回已读取的世界书及条目",
  "description": "等待指定世界书内容读取完成，连同名称列表、角色绑定和实际读取对象返回。主服务据此决定是否需要建立或更新资源。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"返回已读取的世界书及条目的请求和已有进度"}],"provides":[{"key":"era_tavern_worldbook_read_execute_frame","type":"era.tavern.frame.worldbook_read.execute","display_name":"返回已读取的世界书及条目的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_worldbook_read_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“返回已读取的世界书及条目”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_worldbook_read_execute_frame":["保留“返回已读取的世界书及条目”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/worldbook.ts","export":"ReadWorldbook"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.worldbook_read.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_worldbook_read_start_operation = defineNode({
  "display_name": "读取世界书名称、绑定并查询条目",
  "description": "先取得已有世界书和当前角色绑定，按请求名称或角色主世界书发起条目读取。后续等待结果，供初始化比较现有 ERA 规则资源。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.worldbook_read.check_request","cardinality":"exactly_one","display_name":"读取世界书名称、绑定并查询条目的请求和已有进度"}],"provides":[{"key":"era_tavern_worldbook_read_start_operation_frame","type":"era.tavern.call.frame","display_name":"读取世界书名称、绑定并查询条目的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_worldbook_read_start_operation_frame"}},"input_semantics":{"era.tavern.frame.worldbook_read.check_request":["保留“读取世界书名称、绑定并查询条目”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_worldbook_read_start_operation_frame":["保留“读取世界书名称、绑定并查询条目”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/worldbook.ts","export":"StartRead"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.worldbook_read.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_worldbook_replace_entries_execute = defineNode({
  "display_name": "确认世界书条目保存完成",
  "description": "等待已发起的条目替换结束，返回世界书名称和提交条目数。主服务据此记录资源初始化的实际进度。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"确认世界书条目保存完成的请求和已有进度"}],"provides":[{"key":"era_tavern_worldbook_replace_entries_execute_frame","type":"era.tavern.frame.worldbook_replace_entries.execute","display_name":"确认世界书条目保存完成的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_worldbook_replace_entries_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“确认世界书条目保存完成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_worldbook_replace_entries_execute_frame":["保留“确认世界书条目保存完成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/worldbook.ts","export":"ReplaceEntries"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.worldbook_replace_entries.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_worldbook_replace_entries_start_operation = defineNode({
  "display_name": "按明确清单发起世界书条目替换",
  "description": "检查世界书名称及完整条目列表，复制请求内容并向酒馆发起替换。后续等待真实保存，确保资源执行使用明确给出的条目。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.worldbook_replace_entries.check_request","cardinality":"exactly_one","display_name":"按明确清单发起世界书条目替换的请求和已有进度"}],"provides":[{"key":"era_tavern_worldbook_replace_entries_start_operation_frame","type":"era.tavern.call.frame","display_name":"按明确清单发起世界书条目替换的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_worldbook_replace_entries_start_operation_frame"}},"input_semantics":{"era.tavern.frame.worldbook_replace_entries.check_request":["保留“按明确清单发起世界书条目替换”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_worldbook_replace_entries_start_operation_frame":["保留“按明确清单发起世界书条目替换”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/worldbook.ts","export":"StartReplace"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.worldbook_replace_entries.start_operation",
  "node_type": "vibeflow.node"
});
