import {defineNode} from "@vibeflow/plugin";

export const era_command_compaction_analyze_dependencies = defineNode({
  "display_name": "找出不能随意合并的指令关系",
  "description": "查看原指令的计算记录，找出变量、函数和随机结果之间的依赖，标明不能跨越的改写范围。后续只在这些约束允许的地方生成较短指令，避免改变执行效果。",
  "version": "1.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command_compaction.semantic_trace","cardinality":"exactly_one","display_name":"原指令的计算结果和依赖记录"}],"provides":[{"key":"symbols","type":"era.command_compaction.symbols","display_name":"变量、函数、随机结果的依赖与改写限制"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command_compaction.semantic_trace":["作为压缩前应有行为的依据，尚未保存到聊天。"]},"output_semantics":{"symbols":["供只在安全范围内提出较短指令，不跨越会改变效果的边界。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/analyze_dependencies.ts","export":"run"}}],
  "base_libs": ["era.command_compaction.stages","era.command_compaction.engine"],
  "tags": ["ERA 命令压缩"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command_compaction.analyze_dependencies",
  "node_type": "vibeflow.node"
});
