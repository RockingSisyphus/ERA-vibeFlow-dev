import {defineNode} from "@vibeflow/plugin";

export const era_tavern_cap_sync_regex_choose = defineNode({
  "display_name": "选择角色正则规则的具体操作",
  "description": "接收角色正则规则请求，读取明确操作种类，选择本组已声明的一条处理路径。未知操作报告原因，有效操作交给对应步骤完成，并返回实际结果。",
  "version": "0.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"选择角色正则规则的具体操作的请求和已有进度"}],"provides":[{"key":"era_tavern_cap_sync_regex_choose_frame","type":"era.tavern.call.frame","display_name":"选择角色正则规则的具体操作的处理进度及结果"},{"key":"era_tavern_cap_sync_regex_choose_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"},"operations":{"type":"array","items":{"type":"string"}}},"params_defaults":{"outputKeys":{"frame":"era_tavern_cap_sync_regex_choose_frame","route":"era_tavern_cap_sync_regex_choose_route"},"operations":["read","upsert"]},"input_semantics":{"era.tavern.call.frame":["保留“选择角色正则规则的具体操作”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_cap_sync_regex_choose_frame":["保留“选择角色正则规则的具体操作”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_cap_sync_regex_choose_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"ChooseOperation"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.cap_sync_regex.choose",
  "node_type": "vibeflow.node"
});

export const era_tavern_cap_sync_regex_join_return = defineNode({
  "display_name": "交接分派角色正则规则操作的选中结果",
  "description": "在“分派角色正则规则操作”中，接收本次实际选择的分支所产生的唯一结果，交给后续步骤或调用方。每次只允许一份实际结果，避免把互斥分支误当成多个都已执行。",
  "version": "0.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"all","display_name":"交接分派角色正则规则操作的选中结果的请求和已有进度"}],"provides":[{"key":"era_tavern_cap_sync_regex_join_return_frame","type":"era.tavern.frame.final.cap_sync_regex","display_name":"交接分派角色正则规则操作的选中结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_cap_sync_regex_join_return_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“交接分派角色正则规则操作的选中结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_cap_sync_regex_join_return_frame":["保留“交接分派角色正则规则操作的选中结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Join"}}],
  "rulesets": ["vibeflow.process"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.cap_sync_regex.join_return",
  "node_type": "vibeflow.node"
});
