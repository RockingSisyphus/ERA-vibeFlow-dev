import {defineNode} from "@vibeflow/plugin";

export const era_expression_validate_random_context = defineNode({
  "display_name": "传递可重复随机所需的起点",
  "description": "接收入口已经检查过的计算请求，将随机来源和此前使用次数继续交给公式计算。后续据此在重算同一条消息时取得相同随机结果；本环节本身不生成随机数。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.request.normalized","cardinality":"exactly_one","display_name":"已检查并整理好的公式计算请求"}],"provides":[{"key":"validated_random_request","type":"era.expression.request.normalized","display_name":"已检查并整理好的公式计算请求"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.request.normalized":["包含变量起点、函数定义、操作和可重复随机要求，供整个计算流程使用。"]},"output_semantics":{"validated_random_request":["包含变量起点、函数定义、操作和可重复随机要求，供整个计算流程使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/validate_random_context.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.types"],
  "capabilities": [],
  "tags": ["表达式工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.validate_random_context",
  "node_type": "vibeflow.node"
});
