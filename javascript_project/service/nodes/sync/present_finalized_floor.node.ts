import {defineNode} from "@vibeflow/plugin";

export const era_sync_present_finalized_floor = defineNode({
  "display_name": "保存确认后刷新消息显示",
  "description": "消息和变量保存已经确认、且目标消息仍匹配时，请页面刷新相关显示；无需提交时沿用已有刷新要求。显示问题单独记录，让调用方区分保存结果与呈现结果。",
  "version": "1.0.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.commit.result","cardinality":"exactly_one","display_name":"消息和状态文件实际保存的结论"}],"provides":[{"key":"presented_sync_commit_result","type":"era.tavern.commit.result","display_name":"消息和状态文件实际保存的结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.tavern.commit.result":["记录成功、部分写入、来源变化或未确认状态，供恢复、刷新和任务回告使用。"]},"output_semantics":{"presented_sync_commit_result":["记录成功、部分写入、来源变化或未确认状态，供恢复、刷新和任务回告使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"suspend","source":{"kind":"file","ref":"nodes/sync/present_finalized_floor.ts","export":"run"}}],
  "base_libs": ["era.service.sync_commit_policy","era.service.sync_contracts"],
  "capabilities": [{"id":"era.tavern.messages","operations":["refresh"]}],
  "tags": ["同步事务"],
  "rulesets": ["vibeflow.data_store"],
  "id": "era.sync.present_finalized_floor",
  "node_type": "vibeflow.node"
});
