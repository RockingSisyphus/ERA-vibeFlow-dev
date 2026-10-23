import {defineNode} from "@vibeflow/plugin";

export const era_tavern_variables_commit = defineNode({
  "display_name": "保存消息和变量状态并确认结果",
  "description": "先保存并确认当前批次的消息正文，再写入独立状态文件并检查版本和聊天绑定。消息来源变化时要求重新计算；部分保存或结果无法确认时保留真实进度及恢复、停止原因。",
  "version": "1.0.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.commit.request","cardinality":"exactly_one","display_name":"本批待保存的消息与状态文件内容"}],"provides":[{"key":"sync_commit_result","type":"era.tavern.commit.result","display_name":"消息和状态文件实际保存的结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.tavern.commit.request":["包含本轮内存计算后准备提交的正文、变量记录及保存依据，实际保存尚待酒馆执行确认。"]},"output_semantics":{"sync_commit_result":["记录成功、部分写入、来源变化或未确认状态，供恢复、刷新和任务回告使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"suspend","source":{"kind":"file","ref":"nodes/sync/commit_sync.ts","export":"run"}}],
  "base_libs": ["era.service.mk_engine","era.service.sidecar_binding","era.service.sync_commit_policy","era.service.sync_contracts"],
  "capabilities": [{"id":"era.tavern.messages","operations":["update_content"]},{"id":"era.tavern.sidecar","operations":["read_current","read_record","write_record","commit_metadata","present_prompt","read_working","write_working"]}],
  "tags": ["同步宿主边界"],
  "rulesets": ["vibeflow.data_store"],
  "id": "era.tavern.variables_commit",
  "node_type": "vibeflow.node"
});
