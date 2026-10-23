import {defineNode} from "@vibeflow/plugin";

export const era_expression_derive_symbolic_layer = defineNode({
  "display_name": "找出能表达相同变化的较短公式",
  "description": "根据本轮已经完成的变量计算，尝试把每个变量的最终变化表示成相对于计算起点的公式。依赖自动随机结果而无法安全合并的部分会保留原有顺序；输出的是供后续确认的缩短方案。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.sequence.state","cardinality":"exactly_one","display_name":"当前公式计算位置和已更新变量"},{"type":"era.expression.execution.result","cardinality":"exactly_one","display_name":"本轮公式得到的变量和随机使用记录"}],"provides":[{"key":"symbolic_layer","type":"era.expression.symbolic.layer","display_name":"相对起始变量表达的变化方案"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.sequence.state":["包含原始起点、函数、累计结果及随机进度，供逐项计算。"],"era.expression.execution.result":["供整理计算响应以及比较可保持相同效果的公式缩短方案。"]},"output_semantics":{"symbolic_layer":["记录可用较短公式表示的最终变化及不安全部分，供进一步简化而非直接保存。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/derive_symbolic_layer.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.symbolic","era.expression.types"],
  "capabilities": [],
  "tags": ["表达式压缩"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.derive_symbolic_layer",
  "node_type": "vibeflow.node"
});
