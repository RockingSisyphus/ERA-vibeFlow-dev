import {defineNode} from "@vibeflow/plugin";

export const era_lifecycle_publish_block_application = defineNode({
  "display_name": "发布本轮内存状态和待保存正文",
  "description": "将消息指令算出的变量、历史、有效执行范围和待保存正文发布为当前工作状态。普通同步发现回复已经变化时重新计算该分支；作者函数提交失败时保留失败结果，供后续保存和回告。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command_compaction.result","cardinality":"exactly_one","display_name":"已确认历史压缩后可采用的正文结果"}],"provides":[{"key":"block_step_state_after","type":"era.sync.block.step.state.next","display_name":"本段正文处理后的变量和消息进度"},{"key":"block_step_done","type":"era.step.done","display_name":"当前处理范围是否已经结束"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command_compaction.result":["包含验证结论及应保留的历史状态，供合入消息同步结果。"]},"output_semantics":{"block_step_state_after":["包含这一段已算出的变量、函数、历史及下一位置，供消息循环继续处理剩余正文。"],"block_step_done":["循环据此继续下一消息、操作或任务，或进入本范围的最终结果整理。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/shared_block_state_adapters.ts","export":"PublishBlockApplicationNode"}}],
  "base_libs": ["era.service.sync_contracts"],
  "capabilities": [{"id":"era.tavern.sidecar","operations":["read_working","write_working"]}],
  "tags": ["内存生命周期"],
  "rulesets": ["vibeflow.process"],
  "id": "era.lifecycle.publish_block_application",
  "node_type": "vibeflow.node"
});
