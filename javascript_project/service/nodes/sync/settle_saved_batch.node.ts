import {defineNode} from "@vibeflow/plugin";

export const era_lifecycle_settle_saved_batch = defineNode({
  "display_name": "汇总保存结果并决定是否需要恢复",
  "description": "合并消息保存与指令执行的真实结论，保留失败原因。消息来源变化时安排重算，没有待保存内容时清除多余定时安排，使后续知道继续、恢复还是停止。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.tavern.commit.result","cardinality":"exactly_one","display_name":"消息和状态文件实际保存的结论"}],"provides":[{"key":"completed_sync_result","type":"era.tavern.commit.result","display_name":"消息和状态文件实际保存的结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.tavern.commit.result":["记录成功、部分写入、来源变化或未确认状态，供恢复、刷新和任务回告使用。"]},"output_semantics":{"completed_sync_result":["记录成功、部分写入、来源变化或未确认状态，供恢复、刷新和任务回告使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/settle_saved_batch.ts","export":"run"}}],
  "base_libs": [],
  "capabilities": [{"id":"era.lifecycle.admission","operations":["cancel","schedule"]},{"id":"era.tavern.sidecar","operations":["read_working"]}],
  "tags": ["内存生命周期"],
  "rulesets": ["vibeflow.process"],
  "id": "era.lifecycle.settle_saved_batch",
  "node_type": "vibeflow.node"
});
