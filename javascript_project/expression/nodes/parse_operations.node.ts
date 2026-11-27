import {defineNode} from "@vibeflow/plugin";

export const era_expression_parse_operations = defineNode({
  "display_name": "按原顺序整理各项公式",
  "description": "接收需要依次执行的变量计算，读出每项要修改的变量和算式，记录无法识别的内容。保留原有顺序，让后一项公式可以使用前一项刚算出的变量值。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.request.normalized","cardinality":"exactly_one","display_name":"已检查并整理好的公式计算请求"}],"provides":[{"key":"parsed_operations","type":"era.expression.operations.parsed","display_name":"按原顺序读出的变量公式"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.request.normalized":["包含变量起点、函数定义、操作和可重复随机要求，供整个计算流程使用。"]},"output_semantics":{"parsed_operations":["包含每项目标路径及计算结构，后项会使用前项更新后的变量。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/parse_operations.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.syntax","era.expression.types"],
  "tags": ["表达式工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.parse_operations",
  "node_type": "vibeflow.node"
});
