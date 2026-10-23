import {defineNode} from "@vibeflow/plugin";

export const era_tavern_regex_upsert_finish_already_enabled = defineNode({
  "display_name": "沿用已经启用的角色正则",
  "description": "当前角色正则开关已经开启时，保留这一事实，继续进入聊天重新加载。避免为同一开启状态再次保存设置。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.regex_upsert_finish.choose_enabled","cardinality":"exactly_one","display_name":"沿用已经启用的角色正则的请求和已有进度"}],"provides":[{"key":"era_tavern_regex_upsert_finish_already_enabled_frame","type":"era.tavern.frame.regex_upsert_finish.enable_and_save","display_name":"沿用已经启用的角色正则的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_regex_upsert_finish_already_enabled_frame"}},"input_semantics":{"era.tavern.frame.regex_upsert_finish.choose_enabled":["保留“沿用已经启用的角色正则”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_regex_upsert_finish_already_enabled_frame":["保留“沿用已经启用的角色正则”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/flow.ts","export":"Pass"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.browser","era.tavern.frames","era.tavern.resources"],
  "id": "era.tavern.regex_upsert_finish.already_enabled",
  "node_type": "vibeflow.node"
});
