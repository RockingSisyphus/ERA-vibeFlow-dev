import {defineNode} from "@vibeflow/plugin";

export const era_command_compaction_parse_command_blocks = defineNode({
  "display_name": "找出消息中可以分别压缩的指令段",
  "description": "读取消息中的变量和函数指令，按原有顺序识别正文、指令范围和可合并的相邻段落。遇到无法确认作用范围的内容时保留原文，为后续逐段尝试缩短指令划定边界。",
  "version": "1.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command_compaction.request","cardinality":"exactly_one","display_name":"原消息、变量起点和指令压缩要求"}],"provides":[{"key":"parsed","type":"era.command_compaction.parsed","display_name":"按原顺序识别的正文和指令段"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command_compaction.request":["供在同一起点比较原文与较短指令的实际效果。"]},"output_semantics":{"parsed":["保留各段作用范围及位置，供逐段尝试缩短。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/parse_command_blocks.ts","export":"run"}}],
  "base_libs": ["era.command_compaction.stages"],
  "tags": ["ERA 命令压缩"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command_compaction.parse_command_blocks",
  "node_type": "vibeflow.node"
});
