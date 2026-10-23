import {defineNode} from "@vibeflow/plugin";

export const era_command_compaction_initialize_segments = defineNode({
  "display_name": "准备逐段压缩的起点",
  "description": "装入原消息的变量、函数和随机使用位置，从第一段开始记录进度。每段完成后的实际状态会传给下一段，确保逐段压缩仍遵守原消息的执行顺序。",
  "version": "1.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command_compaction.parsed","cardinality":"exactly_one","display_name":"按原顺序识别的正文和指令段"}],"provides":[{"key":"segment_state","type":"era.command_compaction.segment.state","display_name":"分段压缩的进度、累计文字和状态"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command_compaction.parsed":["保留各段作用范围及位置，供逐段尝试缩短。"]},"output_semantics":{"segment_state":["当前段完成后保留实际变量，作为下一段起点继续处理。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize_segments.ts","export":"run"}}],
  "base_libs": ["era.command_compaction.stages"],
  "capabilities": [],
  "tags": ["ERA 命令压缩"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command_compaction.initialize_segments",
  "node_type": "vibeflow.node"
});
