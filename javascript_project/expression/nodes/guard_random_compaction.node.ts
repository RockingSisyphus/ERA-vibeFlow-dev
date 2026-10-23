import {defineNode} from "@vibeflow/plugin";

export const era_expression_guard_random_compaction = defineNode({
  "display_name": "交接已排除不安全随机合并的方案",
  "description": "接收公式推导步骤已经筛选过的缩短方案及问题记录，交给文字简化步骤。随机调用及其影响范围的判断已在推导时完成，此处原样交接，保留后续核对所需依据。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.symbolic.layer","cardinality":"exactly_one","display_name":"相对起始变量表达的变化方案"}],"provides":[{"key":"random_guarded_symbolic_layer","type":"era.expression.symbolic.layer","display_name":"相对起始变量表达的变化方案"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.symbolic.layer":["记录可用较短公式表示的最终变化及不安全部分，供进一步简化而非直接保存。"]},"output_semantics":{"random_guarded_symbolic_layer":["记录可用较短公式表示的最终变化及不安全部分，供进一步简化而非直接保存。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/guard_random_compaction.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.types"],
  "capabilities": [],
  "tags": ["表达式工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.guard_random_compaction",
  "node_type": "vibeflow.node"
});
