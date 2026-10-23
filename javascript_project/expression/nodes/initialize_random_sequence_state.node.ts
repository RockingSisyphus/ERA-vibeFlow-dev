import {defineNode} from "@vibeflow/plugin";

export const era_expression_initialize_random_sequence_state = defineNode({
  "display_name": "准备变量起点和随机使用进度",
  "description": "保存本轮开始前的变量，装入有序公式和函数库，并从请求指定的位置记录随机使用次数。后续计算可继续前面的随机顺序，原始起点则用于重复得到相同结果。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.request.normalized","cardinality":"exactly_one","display_name":"已检查并整理好的公式计算请求"},{"type":"era.expression.function_library.compiled","cardinality":"exactly_one","display_name":"带可用性结论的函数库"},{"type":"era.expression.operations.parsed","cardinality":"exactly_one","display_name":"按原顺序读出的变量公式"}],"provides":[{"key":"sequence_state","type":"era.expression.sequence.state","display_name":"当前公式计算位置和已更新变量"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.request.normalized":["包含变量起点、函数定义、操作和可重复随机要求，供整个计算流程使用。"],"era.expression.function_library.compiled":["供公式按明确参数调用，有错误时保留问题而不会当成有效函数执行。"],"era.expression.operations.parsed":["包含每项目标路径及计算结构，后项会使用前项更新后的变量。"]},"output_semantics":{"sequence_state":["包含原始起点、函数、累计结果及随机进度，供逐项计算。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize_random_sequence_state.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.functions","era.expression.types"],
  "capabilities": [],
  "tags": ["表达式工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.initialize_random_sequence_state",
  "node_type": "vibeflow.node"
});
