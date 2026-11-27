import {defineNode} from "@vibeflow/plugin";

export const era_expression_normalize_compaction = defineNode({
  "display_name": "整理最终计算结果和公式缩短建议",
  "description": "将可以安全简化的公式写得更短，例如合并常量、去掉无效的加零操作；同时返回本轮变量结果、随机使用次数和问题说明。缩短建议由调用方进一步验证后决定是否用于改写消息。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.sequence.state","cardinality":"exactly_one","display_name":"当前公式计算位置和已更新变量"},{"type":"era.expression.execution.result","cardinality":"exactly_one","display_name":"本轮公式得到的变量和随机使用记录"},{"type":"era.expression.symbolic.layer","cardinality":"exactly_one","display_name":"相对起始变量表达的变化方案"}],"provides":[{"key":"expression_response","type":"era.expression.response","display_name":"公式计算的最终变量和缩短建议"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.sequence.state":["包含原始起点、函数、累计结果及随机进度，供逐项计算。"],"era.expression.execution.result":["供整理计算响应以及比较可保持相同效果的公式缩短方案。"],"era.expression.symbolic.layer":["记录可用较短公式表示的最终变化及不安全部分，供进一步简化而非直接保存。"]},"output_semantics":{"expression_response":["包含实际变量结果、问题及随机进度，调用方据此继续业务处理。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/normalize_compaction.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.symbolic","era.expression.types"],
  "tags": ["表达式压缩"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.normalize_compaction",
  "node_type": "vibeflow.node"
});
