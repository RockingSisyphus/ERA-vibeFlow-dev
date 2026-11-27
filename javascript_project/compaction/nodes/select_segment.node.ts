import {defineNode} from "@vibeflow/plugin";

export const era_command_compaction_select_segment = defineNode({
  "display_name": "取出当前段及执行前的变量",
  "description": "根据进度取出一段正文或同一作用范围内的指令组，带入前一段结束后的变量、函数和随机位置。这份资料作为当前段原文和缩短方案的共同起点。",
  "version": "1.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command_compaction.segment.state","cardinality":"exactly_one","display_name":"分段压缩的进度、累计文字和状态"}],"provides":[{"key":"parsed","type":"era.command_compaction.parsed","display_name":"按原顺序识别的正文和指令段"},{"key":"segment_state_before","type":"era.command_compaction.segment.state.before","display_name":"当前段开始前的变量、函数和随机位置"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command_compaction.segment.state":["当前段完成后保留实际变量，作为下一段起点继续处理。"]},"output_semantics":{"parsed":["保留各段作用范围及位置，供逐段尝试缩短。"],"segment_state_before":["供原段执行和缩短方案比较使用相同起点。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/select_segment.ts","export":"run"}}],
  "base_libs": ["era.command_compaction.stages"],
  "tags": ["ERA 命令压缩"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command_compaction.select_segment",
  "node_type": "vibeflow.node"
});
