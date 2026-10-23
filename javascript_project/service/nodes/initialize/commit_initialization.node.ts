import {defineNode} from "@vibeflow/plugin";

export const era_tavern_initialization_commit = defineNode({
  "display_name": "按计划安装或更新角色的 ERA 资源",
  "description": "接收初始化资源变更计划，按顺序写入设置、世界书、正则和开场白等资源，并记录每项实际进度。开场白保存后按实际聊天决定更新、新建或保留首条消息；目标变化或部分失败时带回已完成内容和原因。",
  "version": "1.0.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.initialize.commit.request","cardinality":"exactly_one","display_name":"需要实际安装或修改的资源计划"}],"provides":[{"key":"resource_commit_result","type":"era.initialize.commit.result","display_name":"初始化资源的真实写入进度和结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.initialize.commit.request":["包含明确的设置、世界书、正则和开场白改动，供酒馆逐项执行。"]},"output_semantics":{"resource_commit_result":["记录哪些改动已经完成、哪些失败，供决定后续同步或返回原因。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"suspend","source":{"kind":"file","ref":"nodes/initialize/commit_initialization.ts","export":"run"}}],
  "base_libs": ["era.service.greeting_refresh_policy","era.service.initialization_transaction"],
  "capabilities": [{"id":"era.tavern.variables","operations":["commit"]},{"id":"era.tavern.worldbook","operations":["create","bind","replace_entries"]},{"id":"era.tavern.regex","operations":["upsert"]},{"id":"era.tavern.character","operations":["write_main_greeting","patch_external_statusbar","patch_single_floor","read_greeting_refresh_context","apply_greeting_refresh"]}],
  "tags": ["初始化宿主边界"],
  "rulesets": ["vibeflow.data_store"],
  "id": "era.tavern.initialization_commit",
  "node_type": "vibeflow.node"
});
