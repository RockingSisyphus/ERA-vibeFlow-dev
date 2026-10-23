import {defineNode} from "@vibeflow/plugin";

export const era_command_compaction_execute_original_semantics = defineNode({
  "display_name": "先算出原指令本来会产生什么",
  "description": "按正式变量及函数规则执行当前原文，取得应有的变量、函数、随机使用次数和问题记录。结果只存在于本次计算中，作为后续判断缩短方案是否保持效果的比较依据。",
  "version": "1.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command_compaction.parsed","cardinality":"exactly_one","display_name":"按原顺序识别的正文和指令段"}],"provides":[{"key":"trace","type":"era.command_compaction.semantic_trace","display_name":"原指令的计算结果和依赖记录"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command_compaction.parsed":["保留各段作用范围及位置，供逐段尝试缩短。"]},"output_semantics":{"trace":["作为压缩前应有行为的依据，尚未保存到聊天。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/execute_original_semantics.ts","export":"run"}}],
  "base_libs": ["era.command_compaction.stages","era.command_compaction.engine"],
  "capabilities": [],
  "tags": ["ERA 命令压缩"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command_compaction.execute_original_semantics",
  "node_type": "vibeflow.node"
});
