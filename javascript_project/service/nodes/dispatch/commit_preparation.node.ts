import {defineNode} from "@vibeflow/plugin";

export const era_dispatch_commit_preparation = defineNode({
  "display_name": "保存消息标识及必要的显示占位",
  "description": "接收单独更新消息标识任务准备的正文和内部记录，逐项写入并确认结果。消息标识用于关联消息与变量历史；无法确认写入状态时返回停止原因，供后续避免继续使用不确定数据。",
  "version": "1.0.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.dispatch.preparation.plan","cardinality":"exactly_one","display_name":"任务需要的消息标识及待写入内容"}],"provides":[{"key":"committed_preparation_outcome","type":"era.dispatch.preparation.outcome","display_name":"任务资料准备和必要写入的结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.dispatch.preparation.plan":["记录根据真实消息准备的历史身份和显示占位改动，供保留到统一保存或直接提交。"]},"output_semantics":{"committed_preparation_outcome":["包含准备好的正文、内部记录、实际写入结论和问题，供形成任务执行资料。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"suspend","source":{"kind":"file","ref":"nodes/dispatch/commit_preparation.ts","export":"run"}}],
  "base_libs": ["era.service.dispatch_preparation","era.service.sidecar_binding"],
  "capabilities": [{"id":"era.tavern.messages","operations":["update_content"]},{"id":"era.tavern.sidecar","operations":["read_current","read_record","write_record","commit_metadata"]}],
  "tags": ["任务派发"],
  "rulesets": ["vibeflow.data_store"],
  "id": "era.dispatch.commit_preparation",
  "node_type": "vibeflow.node"
});
