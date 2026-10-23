import {defineNode} from "@vibeflow/plugin";

export const era_command_compaction_rewrite_safe_regions = defineNode({
  "display_name": "尝试生成更短的指令文字",
  "description": "根据已确认的依赖和作用范围，为可安全合并的部分提出较短指令，并保留原文及位置供比较。无法安全缩短的部分继续保留原文，提议还需经过实际重算验证。",
  "version": "1.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command_compaction.symbols","cardinality":"exactly_one","display_name":"变量、函数、随机结果的依赖与改写限制"}],"provides":[{"key":"candidate","type":"era.command_compaction.candidate","display_name":"当前段提出的缩短指令方案"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command_compaction.symbols":["供只在安全范围内提出较短指令，不跨越会改变效果的边界。"]},"output_semantics":{"candidate":["还需从同一起点实际执行并与原文比较，才能决定采用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/rewrite_safe_regions.ts","export":"run"}}],
  "base_libs": ["era.command_compaction.stages","era.command_compaction.engine"],
  "capabilities": [],
  "tags": ["ERA 命令压缩"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command_compaction.rewrite_safe_regions",
  "node_type": "vibeflow.node"
});
