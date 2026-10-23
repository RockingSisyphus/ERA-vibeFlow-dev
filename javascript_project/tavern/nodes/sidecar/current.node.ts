import {defineNode} from "@vibeflow/plugin";

export const era_tavern_sidecar_commit_metadata_check_pointer = defineNode({
  "display_name": "确认文件绑定和变量读数属于当前聊天",
  "description": "接收要绑定的独立状态文件身份，核对目标消息、原绑定和待发布变量资料的归属。通过后才能更新聊天绑定，避免把其他聊天的数据接到当前聊天。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"确认文件绑定和变量读数属于当前聊天的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_commit_metadata_check_pointer_frame","type":"era.tavern.frame.sidecar_commit_metadata.check_pointer","display_name":"确认文件绑定和变量读数属于当前聊天的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_commit_metadata_check_pointer_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“确认文件绑定和变量读数属于当前聊天”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_commit_metadata_check_pointer_frame":["保留“确认文件绑定和变量读数属于当前聊天”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/current.ts","export":"CheckPointer"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_commit_metadata.check_pointer",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_commit_metadata_check_working_version = defineNode({
  "display_name": "检查待发布变量是否仍是当前版本",
  "description": "查看准备发布的变量读数与当前聊天工作状态版本。版本仍匹配且有读数时继续发布，不符合时跳过，避免旧任务覆盖更新的页面状态。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_commit_metadata.write_pointer","cardinality":"exactly_one","display_name":"检查待发布变量是否仍是当前版本的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_commit_metadata_check_working_version_frame","type":"era.tavern.frame.sidecar_commit_metadata.check_working_version","display_name":"检查待发布变量是否仍是当前版本的处理进度及结果"},{"key":"era_tavern_sidecar_commit_metadata_check_working_version_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_commit_metadata_check_working_version_frame","route":"era_tavern_sidecar_commit_metadata_check_working_version_route"}},"input_semantics":{"era.tavern.frame.sidecar_commit_metadata.write_pointer":["保留“检查待发布变量是否仍是当前版本”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_commit_metadata_check_working_version_frame":["保留“检查待发布变量是否仍是当前版本”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_sidecar_commit_metadata_check_working_version_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/current.ts","export":"CheckWorkingVersion"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_commit_metadata.check_working_version",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_commit_metadata_publish_snapshot = defineNode({
  "display_name": "发布当前聊天已确认的变量读数（绑定文件并发布变量）",
  "description": "本次处理“绑定文件并发布变量”。将本次已确认的变量、函数及历史资料整理成只读快照，只有所属聊天仍是当前聊天时才更新页面并按需通知订阅者。其他聊天的迟到结果返回忽略确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_commit_metadata.check_working_version","cardinality":"exactly_one","display_name":"发布当前聊天已确认的变量读数（绑定文件并发布变量）的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_commit_metadata_publish_snapshot_frame","type":"era.tavern.frame.sidecar_commit_metadata.publish_snapshot","display_name":"发布当前聊天已确认的变量读数（绑定文件并发布变量）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_commit_metadata_publish_snapshot_frame"}},"input_semantics":{"era.tavern.frame.sidecar_commit_metadata.check_working_version":["保留“发布当前聊天已确认的变量读数（绑定文件并发布变量）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_commit_metadata_publish_snapshot_frame":["保留“发布当前聊天已确认的变量读数（绑定文件并发布变量）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/current.ts","export":"PublishSnapshot"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_commit_metadata.publish_snapshot",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_commit_metadata_read_back = defineNode({
  "display_name": "回读聊天实际保存的文件绑定",
  "description": "聊天文件指向更新后，重新读取聊天变量并返回实际绑定及文件身份。主服务据此确认当前聊天连接的是本次选择的独立状态文件。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_commit_metadata.check_working_version","cardinality":"all","display_name":"回读聊天实际保存的文件绑定的请求和已有进度"},{"type":"era.tavern.frame.sidecar_commit_metadata.publish_snapshot","cardinality":"all","display_name":"回读聊天实际保存的文件绑定的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_commit_metadata_read_back_frame","type":"era.tavern.call.frame","display_name":"回读聊天实际保存的文件绑定的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_commit_metadata_read_back_frame"}},"input_semantics":{"era.tavern.frame.sidecar_commit_metadata.check_working_version":["保留“回读聊天实际保存的文件绑定”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"],"era.tavern.frame.sidecar_commit_metadata.publish_snapshot":["保留“回读聊天实际保存的文件绑定”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_commit_metadata_read_back_frame":["保留“回读聊天实际保存的文件绑定”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/current.ts","export":"ReadBack"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_commit_metadata.read_back",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_commit_metadata_write_pointer = defineNode({
  "display_name": "保存聊天与独立状态文件的关联",
  "description": "将当前聊天的 ERA 记录更新为所选独立状态文件的指向，并移除已迁出聊天的旧变量数据。后续读取绑定和发布读数，使聊天使用统一状态来源。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_commit_metadata.check_pointer","cardinality":"exactly_one","display_name":"保存聊天与独立状态文件的关联的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_commit_metadata_write_pointer_frame","type":"era.tavern.frame.sidecar_commit_metadata.write_pointer","display_name":"保存聊天与独立状态文件的关联的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_commit_metadata_write_pointer_frame"}},"input_semantics":{"era.tavern.frame.sidecar_commit_metadata.check_pointer":["保留“保存聊天与独立状态文件的关联”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_commit_metadata_write_pointer_frame":["保留“保存聊天与独立状态文件的关联”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/current.ts","export":"WritePointer"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_commit_metadata.write_pointer",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_publish_snapshot_execute = defineNode({
  "display_name": "发布当前聊天已确认的变量读数（发布变量只读快照）",
  "description": "本次处理“发布变量只读快照”。将本次已确认的变量、函数及历史资料整理成只读快照，只有所属聊天仍是当前聊天时才更新页面并按需通知订阅者。其他聊天的迟到结果返回忽略确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_publish_snapshot.check_request","cardinality":"exactly_one","display_name":"发布当前聊天已确认的变量读数（发布变量只读快照）的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_publish_snapshot_execute_frame","type":"era.tavern.frame.sidecar_publish_snapshot.execute","display_name":"发布当前聊天已确认的变量读数（发布变量只读快照）的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_publish_snapshot_execute_frame"}},"input_semantics":{"era.tavern.frame.sidecar_publish_snapshot.check_request":["保留“发布当前聊天已确认的变量读数（发布变量只读快照）”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_publish_snapshot_execute_frame":["保留“发布当前聊天已确认的变量读数（发布变量只读快照）”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/current.ts","export":"PublishSnapshot"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_publish_snapshot.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_read_current_execute = defineNode({
  "display_name": "读取当前聊天的状态文件绑定",
  "description": "读取当前聊天身份及它保存的独立状态文件指向，同时带上尚存的旧变量资料。主服务据此判断正常加载、旧数据迁移或文件绑定修复。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_read_current.check_request","cardinality":"exactly_one","display_name":"读取当前聊天的状态文件绑定的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_read_current_execute_frame","type":"era.tavern.frame.sidecar_read_current.execute","display_name":"读取当前聊天的状态文件绑定的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_read_current_execute_frame"}},"input_semantics":{"era.tavern.frame.sidecar_read_current.check_request":["保留“读取当前聊天的状态文件绑定”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_read_current_execute_frame":["保留“读取当前聊天的状态文件绑定”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/current.ts","export":"ReadCurrent"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_read_current.execute",
  "node_type": "vibeflow.node"
});
