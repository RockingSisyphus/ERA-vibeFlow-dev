import {defineNode} from "@vibeflow/plugin";

export const era_expression_evaluate_ast = defineNode({
  "display_name": "计算当前公式的结果",
  "description": "使用本次变量、函数参数和随机进度，逐步算出当前公式的值，并保留计算问题。结果交给下一步判断能否写入目标变量；涉及嵌套函数时也遵守同一计算顺序。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.ast_frame.state","cardinality":"exactly_one","display_name":"当前公式各步运算和函数参数的进度"}],"provides":[{"key":"evaluated_expression","type":"era.expression.value","display_name":"当前公式实际算出的数值及问题"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.ast_frame.state":["供逐步计算嵌套表达式及函数，仍保留无效输入的错误结论。"]},"output_semantics":{"evaluated_expression":["尚需检查成功且数值有效，才能应用到本轮目标变量。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/execution/evaluate_ast.ts","export":"run"}}],
  "base_libs": ["era.expression.types","era.expression.operation"],
  "capabilities": [],
  "tags": ["表达式执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.evaluate_ast",
  "node_type": "vibeflow.node"
});
