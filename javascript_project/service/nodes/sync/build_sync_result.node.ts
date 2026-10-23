import {defineNode} from "@vibeflow/plugin";

export const era_sync_build_notification = defineNode({
  "display_name": "返回同步保存的实际结果",
  "description": "根据消息和独立状态文件的实际保存结论，为原事件生成确认、页面通知及问题说明。明确区分成功、无变化、失败和需要停止服务的情况，并带回最新消息进度。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.commit.result","cardinality":"exactly_one","display_name":"消息和状态文件实际保存的结论"}],"provides":[{"key":"sync_task_result","type":"era.task.result","display_name":"本项任务对应原事件的处理结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.tavern.commit.result":["记录成功、部分写入、来源变化或未确认状态，供恢复、刷新和任务回告使用。"]},"output_semantics":{"sync_task_result":["包含实际成功、无变化、失败或取消，以及通知和问题说明，供批次集中回告发起者。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/build_sync_result.ts","export":"run"}}],
  "base_libs": ["era.service.sync_contracts","era.service.sync_result_policy"],
  "capabilities": [],
  "tags": ["同步事务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.sync.build_notification",
  "node_type": "vibeflow.node"
});
