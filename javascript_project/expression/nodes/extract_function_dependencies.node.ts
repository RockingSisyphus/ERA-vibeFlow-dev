import {defineNode} from "@vibeflow/plugin";

export const era_expression_extract_function_dependencies = defineNode({
  "display_name": "找出自定义函数之间的调用关系",
  "description": "查看每个自定义函数的算式，列出它会调用哪些其他自定义函数。例如甲使用乙的结果，就记录甲依赖乙；这些关系用于发现互相循环调用的定义。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.function_library.parsed","cardinality":"exactly_one","display_name":"已经读懂算式结构的自定义函数"}],"provides":[{"key":"function_dependencies","type":"era.expression.function_library.dependencies","display_name":"每个函数会调用哪些其他自定义函数"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.function_library.parsed":["尚需检查名称、参数和调用关系，之后才能作为可用函数库。"]},"output_semantics":{"function_dependencies":["供建立完整依赖关系并检查循环调用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/extract_function_dependencies.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.functions","era.expression.types"],
  "tags": ["表达式工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.extract_function_dependencies",
  "node_type": "vibeflow.node"
});
