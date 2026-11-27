import {defineNode} from "@vibeflow/plugin";

export const era_expression_build_function_call_graph = defineNode({
  "display_name": "整理函数依赖关系供检查",
  "description": "接收各函数调用其他函数的记录，把它们整理为完整的依赖关系，并保留已经发现的问题。下一环节沿这些关系检查是否存在无法结束的循环调用。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.function_library.dependencies","cardinality":"exactly_one","display_name":"每个函数会调用哪些其他自定义函数"},{"type":"era.expression.function_library.purity","cardinality":"exactly_one","display_name":"函数参数和允许运算的检查结果"}],"provides":[{"key":"function_call_graph","type":"era.expression.function_library.call_graph","display_name":"待检查循环的函数调用关系"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.function_library.dependencies":["供建立完整依赖关系并检查循环调用。"],"era.expression.function_library.purity":["包含函数是否隐含读取外部变量、名称和参数数量等问题，供可用性判断。"]},"output_semantics":{"function_call_graph":["记录所有自定义函数之间的依赖及已有问题，供沿关系检查。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/build_function_call_graph.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.types"],
  "tags": ["表达式工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.build_function_call_graph",
  "node_type": "vibeflow.node"
});
