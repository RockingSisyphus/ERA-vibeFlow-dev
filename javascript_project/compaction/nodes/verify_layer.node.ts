import {defineNode} from "@vibeflow/plugin";

export const era_command_compaction_verify_layer = defineNode({
  "display_name": "确认整条消息压缩后效果一致",
  "description": "各段处理结束后，从同一起点比较整条原消息与拼好的缩短消息，核对变量、函数、随机使用和错误情况。整体效果不同就保留原消息，防止各段单独可用却在组合后产生差异。",
  "version": "1.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command_compaction.segment.state","cardinality":"exactly_one","display_name":"分段压缩的进度、累计文字和状态"}],"provides":[{"key":"verified","type":"era.command_compaction.verified","display_name":"当前段或整条消息的压缩确认结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command_compaction.segment.state":["当前段完成后保留实际变量，作为下一段起点继续处理。"]},"output_semantics":{"verified":["包含可采用文字或保留原文的原因，以及真实变量和随机结果。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/verify_layer.ts","export":"run"}}],
  "base_libs": ["era.command_compaction.stages"],
  "capabilities": [],
  "tags": ["ERA 命令压缩"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command_compaction.verify_layer",
  "node_type": "vibeflow.node"
});
