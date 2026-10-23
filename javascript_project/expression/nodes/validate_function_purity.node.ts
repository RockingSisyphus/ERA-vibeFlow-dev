import {defineNode} from "@vibeflow/plugin";

export const era_expression_validate_function_purity = defineNode({
  "display_name": "检查函数参数和允许的运算",
  "description": "检查自定义函数只使用声明的参数，调用的函数确实存在且参数数量正确。禁止函数暗中依赖外部变量或覆盖内建函数；发现的问题会使相应函数库无法作为有效计算依据。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.function_library.parsed","cardinality":"exactly_one","display_name":"已经读懂算式结构的自定义函数"},{"type":"era.expression.function_library.dependencies","cardinality":"exactly_one","display_name":"每个函数会调用哪些其他自定义函数"}],"provides":[{"key":"function_purity_report","type":"era.expression.function_library.purity","display_name":"函数参数和允许运算的检查结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.function_library.parsed":["尚需检查名称、参数和调用关系，之后才能作为可用函数库。"],"era.expression.function_library.dependencies":["供建立完整依赖关系并检查循环调用。"]},"output_semantics":{"function_purity_report":["包含函数是否隐含读取外部变量、名称和参数数量等问题，供可用性判断。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/validate_function_purity.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.functions","era.expression.types"],
  "capabilities": [],
  "tags": ["表达式工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.validate_function_purity",
  "node_type": "vibeflow.node"
});
