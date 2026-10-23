import {defineNode} from "@vibeflow/plugin";

export const era_tavern_variables_commit_check_scope = defineNode({
  "display_name": "确认变量写入的目标范围",
  "description": "检查当前实例可用且请求未取消，读取本次要修改的聊天或脚本变量范围。后续所有写入和回读都使用同一明确目标。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"确认变量写入的目标范围的请求和已有进度"}],"provides":[{"key":"era_tavern_variables_commit_check_scope_frame","type":"era.tavern.frame.variables_commit.check_scope","display_name":"确认变量写入的目标范围的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_variables_commit_check_scope_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“确认变量写入的目标范围”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_variables_commit_check_scope_frame":["保留“确认变量写入的目标范围”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/variables.ts","export":"CheckScope"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.variables_commit.check_scope",
  "node_type": "vibeflow.node"
});

export const era_tavern_variables_commit_choose_write = defineNode({
  "display_name": "区分整份变量替换和部分字段更新",
  "description": "查看本次变量请求，提供完整变量对象时选择替换，否则选择明确字段的合并更新。后续按请求实际含义写入，避免把部分修改误作整库覆盖。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.frame.variables_commit.check_scope","cardinality":"exactly_one","display_name":"区分整份变量替换和部分字段更新的请求和已有进度"}],"provides":[{"key":"era_tavern_variables_commit_choose_write_frame","type":"era.tavern.frame.variables_commit.choose_write","display_name":"区分整份变量替换和部分字段更新的处理进度及结果"},{"key":"era_tavern_variables_commit_choose_write_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_variables_commit_choose_write_frame","route":"era_tavern_variables_commit_choose_write_route"}},"input_semantics":{"era.tavern.frame.variables_commit.check_scope":["保留“区分整份变量替换和部分字段更新”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_variables_commit_choose_write_frame":["保留“区分整份变量替换和部分字段更新”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_variables_commit_choose_write_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/variables.ts","export":"ChooseWrite"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.variables_commit.choose_write",
  "node_type": "vibeflow.node"
});

export const era_tavern_variables_commit_publish_settings = defineNode({
  "display_name": "脚本变量改变后通知设置界面",
  "description": "本次写入属于脚本设置时，通知相关设置观察方刷新。其他变量范围沿用实际结果，随后返回本次写入确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.variables_commit.read_back","cardinality":"exactly_one","display_name":"脚本变量改变后通知设置界面的请求和已有进度"}],"provides":[{"key":"era_tavern_variables_commit_publish_settings_frame","type":"era.tavern.call.frame","display_name":"脚本变量改变后通知设置界面的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_variables_commit_publish_settings_frame"}},"input_semantics":{"era.tavern.frame.variables_commit.read_back":["保留“脚本变量改变后通知设置界面”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_variables_commit_publish_settings_frame":["保留“脚本变量改变后通知设置界面”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/variables.ts","export":"PublishSettings"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.variables_commit.publish_settings",
  "node_type": "vibeflow.node"
});

export const era_tavern_variables_commit_read_back = defineNode({
  "display_name": "回读写入后的实际酒馆变量",
  "description": "读取刚写入范围的现有变量，返回目标范围及实际内容，作为本次提交确认。调用方可以据此核对写入结果。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.variables_commit.write","cardinality":"exactly_one","display_name":"回读写入后的实际酒馆变量的请求和已有进度"}],"provides":[{"key":"era_tavern_variables_commit_read_back_frame","type":"era.tavern.frame.variables_commit.read_back","display_name":"回读写入后的实际酒馆变量的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_variables_commit_read_back_frame"}},"input_semantics":{"era.tavern.frame.variables_commit.write":["保留“回读写入后的实际酒馆变量”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_variables_commit_read_back_frame":["保留“回读写入后的实际酒馆变量”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/variables.ts","export":"ReadBack"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.variables_commit.read_back",
  "node_type": "vibeflow.node"
});

export const era_tavern_variables_commit_select_patch = defineNode({
  "display_name": "准备只更新请求给出的字段",
  "description": "接收明确指定的字段变化，交给统一写入步骤合并到所选范围。未指定字段保留，后续回读实际变量供调用方确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.variables_commit.choose_write","cardinality":"exactly_one","display_name":"准备只更新请求给出的字段的请求和已有进度"}],"provides":[{"key":"era_tavern_variables_commit_select_patch_frame","type":"era.tavern.frame.variables_commit.choose_write","display_name":"准备只更新请求给出的字段的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_variables_commit_select_patch_frame"}},"input_semantics":{"era.tavern.frame.variables_commit.choose_write":["保留“准备只更新请求给出的字段”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_variables_commit_select_patch_frame":["保留“准备只更新请求给出的字段”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/variables.ts","export":"SelectPatch"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.variables_commit.select_patch",
  "node_type": "vibeflow.node"
});

export const era_tavern_variables_commit_select_replace = defineNode({
  "display_name": "准备替换整份目标变量",
  "description": "接收明确指定的完整变量对象，交给统一写入步骤。该分支会用新对象替换所选范围的原变量，后续再回读确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.variables_commit.choose_write","cardinality":"exactly_one","display_name":"准备替换整份目标变量的请求和已有进度"}],"provides":[{"key":"era_tavern_variables_commit_select_replace_frame","type":"era.tavern.frame.variables_commit.choose_write","display_name":"准备替换整份目标变量的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_variables_commit_select_replace_frame"}},"input_semantics":{"era.tavern.frame.variables_commit.choose_write":["保留“准备替换整份目标变量”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_variables_commit_select_replace_frame":["保留“准备替换整份目标变量”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/variables.ts","export":"SelectReplace"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.variables_commit.select_replace",
  "node_type": "vibeflow.node"
});

export const era_tavern_variables_commit_write = defineNode({
  "display_name": "执行本次明确的变量替换或字段更新",
  "description": "根据已选方案，将完整对象替换到目标范围，或仅合并指定字段。完成后交给回读步骤确认真实结果，脚本设置变化随后通知页面。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.variables_commit.choose_write","cardinality":"exactly_one","display_name":"执行本次明确的变量替换或字段更新的请求和已有进度"}],"provides":[{"key":"era_tavern_variables_commit_write_frame","type":"era.tavern.frame.variables_commit.write","display_name":"执行本次明确的变量替换或字段更新的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_variables_commit_write_frame"}},"input_semantics":{"era.tavern.frame.variables_commit.choose_write":["保留“执行本次明确的变量替换或字段更新”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_variables_commit_write_frame":["保留“执行本次明确的变量替换或字段更新”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/variables.ts","export":"WriteVariables"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.variables_commit.write",
  "node_type": "vibeflow.node"
});

export const era_tavern_variables_read_execute = defineNode({
  "display_name": "读取请求指定范围的酒馆变量",
  "description": "按请求选择聊天、脚本等允许范围，复制该范围的现有变量并返回。主服务据此准备设置或状态操作，调用取消时按原因结束。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.variables_read.check_request","cardinality":"exactly_one","display_name":"读取请求指定范围的酒馆变量的请求和已有进度"}],"provides":[{"key":"era_tavern_variables_read_execute_frame","type":"era.tavern.frame.variables_read.execute","display_name":"读取请求指定范围的酒馆变量的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_variables_read_execute_frame"}},"input_semantics":{"era.tavern.frame.variables_read.check_request":["保留“读取请求指定范围的酒馆变量”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_variables_read_execute_frame":["保留“读取请求指定范围的酒馆变量”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/variables.ts","export":"ReadVariables"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.variables_read.execute",
  "node_type": "vibeflow.node"
});
