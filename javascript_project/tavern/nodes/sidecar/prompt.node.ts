import {defineNode} from "@vibeflow/plugin";

export const era_tavern_sidecar_clear_prompt_execute = defineNode({
  "display_name": "确认目标后关闭状态文件提示",
  "description": "核对当前消息及预期状态文件绑定仍匹配，再清除页面选择弹窗。返回提示已关闭的确认，避免旧任务误关闭新聊天的提示。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_clear_prompt.check_request","cardinality":"exactly_one","display_name":"确认目标后关闭状态文件提示的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_clear_prompt_execute_frame","type":"era.tavern.frame.sidecar_clear_prompt.execute","display_name":"确认目标后关闭状态文件提示的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_clear_prompt_execute_frame"}},"input_semantics":{"era.tavern.frame.sidecar_clear_prompt.check_request":["保留“确认目标后关闭状态文件提示”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_clear_prompt_execute_frame":["保留“确认目标后关闭状态文件提示”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/prompt.ts","export":"ClearPrompt"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_clear_prompt.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_create_id_execute = defineNode({
  "display_name": "生成新独立状态文件的身份",
  "description": "为即将新建的聊天状态文件分配唯一身份，交给主服务的绑定方案。这里只确定文件名称依据，实际文件内容与保存稍后执行。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_create_id.check_request","cardinality":"exactly_one","display_name":"生成新独立状态文件的身份的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_create_id_execute_frame","type":"era.tavern.frame.sidecar_create_id.execute","display_name":"生成新独立状态文件的身份的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_create_id_execute_frame"}},"input_semantics":{"era.tavern.frame.sidecar_create_id.check_request":["保留“生成新独立状态文件的身份”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_create_id_execute_frame":["保留“生成新独立状态文件的身份”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/prompt.ts","export":"CreateId"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_create_id.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_sidecar_present_prompt_execute = defineNode({
  "display_name": "显示状态文件绑定或修复选项",
  "description": "接收主服务已准备的弹窗内容，复制后通知页面显示。用户可据此选择文件归属或修复方式，本环节返回提示已呈现的确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.sidecar_present_prompt.check_request","cardinality":"exactly_one","display_name":"显示状态文件绑定或修复选项的请求和已有进度"}],"provides":[{"key":"era_tavern_sidecar_present_prompt_execute_frame","type":"era.tavern.frame.sidecar_present_prompt.execute","display_name":"显示状态文件绑定或修复选项的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_sidecar_present_prompt_execute_frame"}},"input_semantics":{"era.tavern.frame.sidecar_present_prompt.check_request":["保留“显示状态文件绑定或修复选项”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_sidecar_present_prompt_execute_frame":["保留“显示状态文件绑定或修复选项”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sidecar/prompt.ts","export":"PresentPrompt"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.sidecar_present_prompt.execute",
  "node_type": "vibeflow.node"
});
