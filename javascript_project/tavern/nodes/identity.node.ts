import {defineNode} from "@vibeflow/plugin";

export const era_tavern_identity_read_execute = defineNode({
  "display_name": "读取当前聊天、角色和脚本身份",
  "description": "读取当前聊天、角色、群聊状态和脚本身份，附上当前实例有效期标记；请求含状态栏来源时也验证其归属。主服务和界面据此确认操作仍对应正确聊天。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.identity_read.check_request","cardinality":"exactly_one","display_name":"读取当前聊天、角色和脚本身份的请求和已有进度"}],"provides":[{"key":"era_tavern_identity_read_execute_frame","type":"era.tavern.frame.identity_read.execute","display_name":"读取当前聊天、角色和脚本身份的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_identity_read_execute_frame"}},"input_semantics":{"era.tavern.frame.identity_read.check_request":["保留“读取当前聊天、角色和脚本身份”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_identity_read_execute_frame":["保留“读取当前聊天、角色和脚本身份”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/identity.ts","export":"ReadIdentity"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.identity_read.execute",
  "node_type": "vibeflow.node"
});

export const era_tavern_installation_scope_read_execute = defineNode({
  "display_name": "查看当前脚本在哪些位置启用",
  "description": "读取脚本自身身份，检查它是否在角色卡、全局或预设中启用。无法读取时如实返回不可用或失败状态，交给主服务作启动决定。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.installation_scope_read.check_request","cardinality":"exactly_one","display_name":"查看当前脚本在哪些位置启用的请求和已有进度"}],"provides":[{"key":"era_tavern_installation_scope_read_execute_frame","type":"era.tavern.frame.installation_scope_read.execute","display_name":"查看当前脚本在哪些位置启用的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_installation_scope_read_execute_frame"}},"input_semantics":{"era.tavern.frame.installation_scope_read.check_request":["保留“查看当前脚本在哪些位置启用”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_installation_scope_read_execute_frame":["保留“查看当前脚本在哪些位置启用”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/identity.ts","export":"ReadInstallationScope"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.installation_scope_read.execute",
  "node_type": "vibeflow.node"
});
