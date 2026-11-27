import {defineNode} from "@vibeflow/plugin";

export const era_expression_reject_recursive_functions = defineNode({
  "display_name": "找出会反复调用自己的函数",
  "description": "沿函数之间的调用关系检查直接或间接自我调用，例如甲调用乙、乙又调用甲。发现时记录完整关系，交给函数库检查结果处理，避免计算陷入无限重复。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.function_library.call_graph","cardinality":"exactly_one","display_name":"待检查循环的函数调用关系"}],"provides":[{"key":"acyclic_function_graph","type":"era.expression.function_library.acyclic_graph","display_name":"经过循环检查的调用关系及问题"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.function_library.call_graph":["记录所有自定义函数之间的依赖及已有问题，供沿关系检查。"]},"output_semantics":{"acyclic_function_graph":["递归问题保留在结果中，后续结合所有诊断决定函数库能否执行。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/reject_recursive_functions.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.functions","era.expression.types"],
  "tags": ["表达式工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.reject_recursive_functions",
  "node_type": "vibeflow.node"
});
