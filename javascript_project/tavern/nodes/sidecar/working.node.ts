import {defineNode} from "@vibeflow/plugin";

export const era_tavern_sidecar_read_working_execute = defineNode({
  "display_name": "读取当前聊天尚在处理的内存状态",
  "description": "按当前聊天身份查找本页保存的工作状态，返回变量、函数及待处理进度；没有时返回缺失。主服务据此继续未保存工作或重新加载独立状态文件。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_read_working.check_request","cardinality":"exactly_one","display_name":"读取当前聊天尚在处理的内存状态的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_read_working_execute_frame","type":"era.tavern.frame.sidecar_read_working.execute","display_name":"读取当前聊天尚在处理的内存状态的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_read_working_execute_frame"}},"input_semantics":{"era.tavern.frame.sidecar_read_working.check_request":["保留“读取当前聊天尚在处理的内存状态”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_read_working_execute_frame":["保留“读取当前聊天尚在处理的内存状态”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/working.ts","export":"ReadWorking"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_read_working.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_write_working_check_request = defineNode({
  "display_name": "检查内存状态更新的归属和版本",
  "description": "核对本次工作记录所属聊天、状态文件、目标消息及预期版本，准备递增版本的内存状态。资料已变化时拒绝旧更新，避免覆盖其他任务的新进度。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"检查内存状态更新的归属和版本的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_write_working_check_request_frame","type":"era.tavern.frame.sidecar_write_working.check_request","display_name":"检查内存状态更新的归属和版本的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_write_working_check_request_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“检查内存状态更新的归属和版本”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_write_working_check_request_frame":["保留“检查内存状态更新的归属和版本”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/working.ts","export":"CheckWorking"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_write_working.check_request",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_write_working_execute = defineNode({
  "display_name": "保存本聊天新的内存工作进度",
  "description": "将检查通过的变量、函数、消息进度和待保存内容存入当前实例，清理其他聊天无需保留的干净缓存。供后续同步、阶段恢复和实际保存继续使用。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_write_working.check_request","cardinality":"exactly_one","display_name":"保存本聊天新的内存工作进度的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_write_working_execute_frame","type":"era.tavern.frame.sidecar_write_working.execute","display_name":"保存本聊天新的内存工作进度的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_write_working_execute_frame"}},"input_semantics":{"era.tavern.frame.sidecar_write_working.check_request":["保留“保存本聊天新的内存工作进度”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_write_working_execute_frame":["保留“保存本聊天新的内存工作进度”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/working.ts","export":"StoreWorking"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_write_working.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_write_working_return_result = defineNode({
  "display_name": "发布当前内存变量读数及工作进度",
  "description": "用新的内存工作记录更新页面可读取的变量快照，并按请求决定是否通知订阅者。返回最新工作状态；这些资料是否已写入文件由后续保存流程确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_write_working.execute","cardinality":"exactly_one","display_name":"发布当前内存变量读数及工作进度的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_write_working_return_result_frame","type":"era.tavern.call.frame","display_name":"发布当前内存变量读数及工作进度的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_write_working_return_result_frame"}},"input_semantics":{"era.tavern.frame.sidecar_write_working.execute":["保留“发布当前内存变量读数及工作进度”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_write_working_return_result_frame":["保留“发布当前内存变量读数及工作进度”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/working.ts","export":"PublishWorking"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_write_working.return_result",
  "node_type": "vibeflow.node"
});
