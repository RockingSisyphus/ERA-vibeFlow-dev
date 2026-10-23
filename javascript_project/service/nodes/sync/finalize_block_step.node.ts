import {defineNode} from "@vibeflow/plugin";

export const era_lifecycle_finalize_block_step = defineNode({
  "display_name": "整理本批消息和变量的待保存内容",
  "description": "将本轮消息指令执行的最终状态整理成保存准备，包含改动的正文和独立状态文件内容。无变化时进入无需保存分支，失败时保留已确认部分及原因，供统一提交判断。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.sync.block.step.state.next","cardinality":"exactly_one","display_name":"本段正文处理后的变量和消息进度"}],"provides":[{"key":"batch_save_request","type":"era.tavern.commit.request","display_name":"本批待保存的消息与状态文件内容"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.sync.block.step.state.next":["包含这一段已算出的变量、函数、历史及下一位置，供消息循环继续处理剩余正文。"]},"output_semantics":{"batch_save_request":["包含本轮内存计算后准备提交的正文、变量记录及保存依据，实际保存尚待酒馆执行确认。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/sync/finalize_block_step.ts","export":"finalize"}}],
  "base_libs": ["era.service.sync_commit_policy","era.service.sync_contracts"],
  "capabilities": [],
  "tags": ["内存生命周期"],
  "rulesets": ["vibeflow.process"],
  "id": "era.lifecycle.finalize_block_step",
  "node_type": "vibeflow.node"
});
