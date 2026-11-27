import {defineNode} from "@vibeflow/plugin";

export const era_command_compaction_advance_segment = defineNode({
  "display_name": "收下当前段并继续下一段",
  "description": "当前段确实缩短且已通过比较时采用新文字，否则保留原文。将原指令实际产生的变量、函数和随机进度传给下一段，并累计完整消息的文字和处理记录。",
  "version": "1.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command_compaction.segment.state.before","cardinality":"exactly_one","display_name":"当前段开始前的变量、函数和随机位置"},{"type":"era.command_compaction.verified","cardinality":"exactly_one","display_name":"当前段或整条消息的压缩确认结果"}],"provides":[{"key":"segment_state_next","type":"era.command_compaction.segment.state","display_name":"分段压缩的进度、累计文字和状态"},{"key":"segment_done","type":"era.command_compaction.segment.done","display_name":"原消息各段是否已经处理完"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command_compaction.verified":["包含可采用文字或保留原文的原因，以及真实变量和随机结果。"],"era.command_compaction.segment.state.before":["供原段执行和缩短方案比较使用相同起点。"]},"output_semantics":{"segment_state_next":["当前段完成后保留实际变量，作为下一段起点继续处理。"],"segment_done":["全部结束后进入整条消息效果比较及最终返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/advance_segment.ts","export":"run"}}],
  "base_libs": ["era.command_compaction.stages","era.command_compaction.engine"],
  "tags": ["ERA 命令压缩"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command_compaction.advance_segment",
  "node_type": "vibeflow.node"
});
