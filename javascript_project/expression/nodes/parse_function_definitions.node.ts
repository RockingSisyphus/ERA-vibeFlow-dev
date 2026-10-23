import {defineNode} from "@vibeflow/plugin";

export const era_expression_parse_function_definitions = defineNode({
  "display_name": "读懂每个自定义函数的算式",
  "description": "逐个读取自定义函数的名称、参数和算式，将算式整理成可以逐步计算的结构。名称、参数或算式有问题时记下位置和原因，供后面的函数检查决定是否允许使用。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.request.normalized","cardinality":"exactly_one","display_name":"已检查并整理好的公式计算请求"}],"provides":[{"key":"parsed_function_library","type":"era.expression.function_library.parsed","display_name":"已经读懂算式结构的自定义函数"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.request.normalized":["包含变量起点、函数定义、操作和可重复随机要求，供整个计算流程使用。"]},"output_semantics":{"parsed_function_library":["尚需检查名称、参数和调用关系，之后才能作为可用函数库。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/parse_function_definitions.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.functions","era.expression.types"],
  "capabilities": [],
  "tags": ["表达式工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.parse_function_definitions",
  "node_type": "vibeflow.node"
});
