import {defineNode} from "@vibeflow/plugin";

export const era_expression_compile_callable_functions = defineNode({
  "display_name": "整理可供公式使用的函数库",
  "description": "把已读懂的函数算式、参数和检查结果整理成一份可调用的函数库。函数定义有错误时保留错误并标记不可用；有效函数供后续逐项公式计算使用。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.function_library.parsed","cardinality":"exactly_one","display_name":"已经读懂算式结构的自定义函数"},{"type":"era.expression.function_library.acyclic_graph","cardinality":"exactly_one","display_name":"经过循环检查的调用关系及问题"}],"provides":[{"key":"compiled_function_library","type":"era.expression.function_library.compiled","display_name":"带可用性结论的函数库"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.function_library.parsed":["尚需检查名称、参数和调用关系，之后才能作为可用函数库。"],"era.expression.function_library.acyclic_graph":["递归问题保留在结果中，后续结合所有诊断决定函数库能否执行。"]},"output_semantics":{"compiled_function_library":["供公式按明确参数调用，有错误时保留问题而不会当成有效函数执行。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/compile_callable_functions.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.functions","era.expression.types"],
  "tags": ["表达式工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.compile_callable_functions",
  "node_type": "vibeflow.node"
});
