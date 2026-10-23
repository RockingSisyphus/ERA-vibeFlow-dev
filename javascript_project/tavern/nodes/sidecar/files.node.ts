import {defineNode} from "@vibeflow/plugin";

export const era_tavern_sidecar_read_record_execute = defineNode({
  "display_name": "等待独立状态文件的读取响应",
  "description": "接收已经发起的状态文件读取，等待酒馆返回响应。实际是否存在及内容是否有效，由后续明确步骤判断。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"等待独立状态文件的读取响应的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_read_record_execute_frame","type":"era.tavern.frame.sidecar_read_record.execute","display_name":"等待独立状态文件的读取响应的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_read_record_execute_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“等待独立状态文件的读取响应”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_read_record_execute_frame":["保留“等待独立状态文件的读取响应”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"AwaitRead"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_read_record.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_read_record_start_operation = defineNode({
  "display_name": "读取指定的独立状态文件",
  "description": "检查请求的文件身份，向酒馆发起文件读取。后续等待响应，区分不存在、可读取或读取失败，供主服务选择加载或恢复。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_read_record.check_request","cardinality":"exactly_one","display_name":"读取指定的独立状态文件的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_read_record_start_operation_frame","type":"era.tavern.call.frame","display_name":"读取指定的独立状态文件的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_read_record_start_operation_frame"}},"input_semantics":{"era.tavern.frame.sidecar_read_record.check_request":["保留“读取指定的独立状态文件”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_read_record_start_operation_frame":["保留“读取指定的独立状态文件”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"StartRead"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_read_record.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_read_record_finish_choose_json = defineNode({
  "display_name": "判断状态文件能否正常解析",
  "description": "尝试读取文件中的结构化内容，成功时交给有效文件分支，失败时交给损坏分支。让主服务能区分文件缺失与文件内容不可用。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_read_record.execute.text","cardinality":"exactly_one","display_name":"判断状态文件能否正常解析的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_read_record_finish_choose_json_frame","type":"era.tavern.frame.sidecar_read_record.execute.parsed","display_name":"判断状态文件能否正常解析的处理进度及结果"},{"key":"era_tavern_sidecar_read_record_finish_choose_json_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_read_record_finish_choose_json_frame","route":"era_tavern_sidecar_read_record_finish_choose_json_route"}},"input_semantics":{"era.tavern.frame.sidecar_read_record.execute.text":["保留“判断状态文件能否正常解析”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_read_record_finish_choose_json_frame":["保留“判断状态文件能否正常解析”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_sidecar_read_record_finish_choose_json_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"ChooseJson"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_read_record_finish.choose_json",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_read_record_finish_choose_response = defineNode({
  "display_name": "区分文件缺失、读取成功或请求失败",
  "description": "检查状态文件读取响应。文件不存在时返回缺失，成功时继续读取内容，其他失败报告原因，供绑定和修复流程采用正确处理方式。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_read_record.execute","cardinality":"exactly_one","display_name":"区分文件缺失、读取成功或请求失败的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_read_record_finish_choose_response_frame","type":"era.tavern.frame.sidecar_read_record.execute.response","display_name":"区分文件缺失、读取成功或请求失败的处理进度及结果"},{"key":"era_tavern_sidecar_read_record_finish_choose_response_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_read_record_finish_choose_response_frame","route":"era_tavern_sidecar_read_record_finish_choose_response_route"}},"input_semantics":{"era.tavern.frame.sidecar_read_record.execute":["保留“区分文件缺失、读取成功或请求失败”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_read_record_finish_choose_response_frame":["保留“区分文件缺失、读取成功或请求失败”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_sidecar_read_record_finish_choose_response_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"ChooseResponse"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_read_record_finish.choose_response",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_read_record_finish_failed = defineNode({
  "display_name": "报告独立状态文件读取失败",
  "description": "读取请求未成功且并非文件不存在时，返回对应失败状态。上层据此报告原因，不会把网络或服务问题当成一份空状态。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_read_record.execute.response","cardinality":"exactly_one","display_name":"报告独立状态文件读取失败的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_read_record_finish_failed_frame","type":"era.tavern.frame.sidecar_read_record.execute.decoded","display_name":"报告独立状态文件读取失败的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_read_record_finish_failed_frame"}},"input_semantics":{"era.tavern.frame.sidecar_read_record.execute.response":["保留“报告独立状态文件读取失败”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_read_record_finish_failed_frame":["保留“报告独立状态文件读取失败”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"Failed"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_read_record_finish.failed",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_read_record_finish_found = defineNode({
  "display_name": "返回读取到的状态文件记录",
  "description": "将已经读出且能够解析的文件内容与文件身份交回主服务。后续继续检查它的归属、版本和业务结构，再决定采用。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_read_record.execute.parsed","cardinality":"exactly_one","display_name":"返回读取到的状态文件记录的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_read_record_finish_found_frame","type":"era.tavern.frame.sidecar_read_record.execute.decoded","display_name":"返回读取到的状态文件记录的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_read_record_finish_found_frame"}},"input_semantics":{"era.tavern.frame.sidecar_read_record.execute.parsed":["保留“返回读取到的状态文件记录”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_read_record_finish_found_frame":["保留“返回读取到的状态文件记录”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"Found"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_read_record_finish.found",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_read_record_finish_invalid = defineNode({
  "display_name": "返回状态文件内容无法解析的确认",
  "description": "文件存在但内容不能解析时，返回无效结论和文件身份。主服务据此提示用户选择修复方式，而不采用无法读取的数据。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_read_record.execute.parsed","cardinality":"exactly_one","display_name":"返回状态文件内容无法解析的确认的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_read_record_finish_invalid_frame","type":"era.tavern.frame.sidecar_read_record.execute.decoded","display_name":"返回状态文件内容无法解析的确认的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_read_record_finish_invalid_frame"}},"input_semantics":{"era.tavern.frame.sidecar_read_record.execute.parsed":["保留“返回状态文件内容无法解析的确认”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_read_record_finish_invalid_frame":["保留“返回状态文件内容无法解析的确认”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"Invalid"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_read_record_finish.invalid",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_read_record_finish_missing = defineNode({
  "display_name": "返回独立状态文件不存在的确认",
  "description": "状态文件读取明确返回不存在时，交出缺失结论和文件身份。主服务据此决定新建、选择其他文件或提示修复。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_read_record.execute.response","cardinality":"exactly_one","display_name":"返回独立状态文件不存在的确认的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_read_record_finish_missing_frame","type":"era.tavern.frame.sidecar_read_record.execute.decoded","display_name":"返回独立状态文件不存在的确认的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_read_record_finish_missing_frame"}},"input_semantics":{"era.tavern.frame.sidecar_read_record.execute.response":["保留“返回独立状态文件不存在的确认”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_read_record_finish_missing_frame":["保留“返回独立状态文件不存在的确认”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"Missing"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_read_record_finish.missing",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_read_record_finish_read_text = defineNode({
  "display_name": "读出状态文件中的实际文字",
  "description": "接收成功的文件响应，读取完整文件内容。后续检查它能否解析为状态记录，供加载或损坏处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_read_record.execute.response","cardinality":"exactly_one","display_name":"读出状态文件中的实际文字的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_read_record_finish_read_text_frame","type":"era.tavern.frame.sidecar_read_record.execute.text","display_name":"读出状态文件中的实际文字的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_read_record_finish_read_text_frame"}},"input_semantics":{"era.tavern.frame.sidecar_read_record.execute.response":["保留“读出状态文件中的实际文字”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_read_record_finish_read_text_frame":["保留“读出状态文件中的实际文字”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"ReadText"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_read_record_finish.read_text",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_write_record_check_record = defineNode({
  "display_name": "检查要保存的状态文件资料",
  "description": "读取待写入文件身份，确认状态记录确实提供，并复制这份记录供后续保存。缺少内容时返回原因，避免发起不完整文件写入。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"检查要保存的状态文件资料的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_write_record_check_record_frame","type":"era.tavern.frame.sidecar_write_record.check_record","display_name":"检查要保存的状态文件资料的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_write_record_check_record_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“检查要保存的状态文件资料”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_write_record_check_record_frame":["保留“检查要保存的状态文件资料”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"CheckRecord"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_write_record.check_record",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_write_record_check_target = defineNode({
  "display_name": "保存文件前核对消息和原绑定",
  "description": "确认本次状态保存仍对应原目标消息和预期文件绑定。通过后才继续准备写入，避免聊天或回复变化后保存到错误状态。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_write_record.check_record","cardinality":"exactly_one","display_name":"保存文件前核对消息和原绑定的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_write_record_check_target_frame","type":"era.tavern.frame.sidecar_write_record.check_target","display_name":"保存文件前核对消息和原绑定的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_write_record_check_target_frame"}},"input_semantics":{"era.tavern.frame.sidecar_write_record.check_record":["保留“保存文件前核对消息和原绑定”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_write_record_check_target_frame":["保留“保存文件前核对消息和原绑定”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"CheckTarget"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_write_record.check_target",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_write_record_encode_file = defineNode({
  "display_name": "把待保存状态整理成上传内容",
  "description": "将本次状态记录转换为酒馆文件上传需要的内容，并使用对应独立状态文件的名称。后续上传步骤据此保存同一份记录。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_write_record.check_target","cardinality":"exactly_one","display_name":"把待保存状态整理成上传内容的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_write_record_encode_file_frame","type":"era.tavern.frame.sidecar_write_record.encode_file","display_name":"把待保存状态整理成上传内容的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_write_record_encode_file_frame"}},"input_semantics":{"era.tavern.frame.sidecar_write_record.check_target":["保留“把待保存状态整理成上传内容”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_write_record_encode_file_frame":["保留“把待保存状态整理成上传内容”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"EncodeFile"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_write_record.encode_file",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_write_record_start_operation = defineNode({
  "display_name": "再次核对来源并上传状态文件",
  "description": "文件内容准备完成后，再检查目标消息和状态文件绑定，随后向酒馆发起上传。后续等待真实响应，供主服务确认这次保存。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_write_record.encode_file","cardinality":"exactly_one","display_name":"再次核对来源并上传状态文件的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_write_record_start_operation_frame","type":"era.tavern.frame.sidecar_write_record.started","display_name":"再次核对来源并上传状态文件的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_write_record_start_operation_frame"}},"input_semantics":{"era.tavern.frame.sidecar_write_record.encode_file":["保留“再次核对来源并上传状态文件”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_write_record_start_operation_frame":["保留“再次核对来源并上传状态文件”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"StartWrite"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_write_record.start_operation",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_write_record_upload_file = defineNode({
  "display_name": "确认独立状态文件上传成功",
  "description": "接收已经发起的文件上传，等待完成并检查成功响应。成功时返回文件身份和地址，失败时报告具体原因，供上层决定继续绑定还是恢复处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"确认独立状态文件上传成功的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_write_record_upload_file_frame","type":"era.tavern.frame.sidecar_write_record.upload_file","display_name":"确认独立状态文件上传成功的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_write_record_upload_file_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“确认独立状态文件上传成功”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_write_record_upload_file_frame":["保留“确认独立状态文件上传成功”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/sidecar/files.ts","export":"AwaitWrite"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_write_record.upload_file",
  "node_type": "vibeflow.node"
});
