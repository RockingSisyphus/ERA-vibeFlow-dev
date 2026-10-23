import {defineNode} from "@vibeflow/plugin";

export const era_expression_validate_request = defineNode({
  "display_name": "检查公式、变量和计算要求",
  "description": "检查本次提供的初始变量、自定义函数及有序计算是否齐全、格式是否可用，数值需有效；有可重复随机要求时也检查其起点。整理有效资料并记录具体问题，供整个公式计算流程使用。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.request","cardinality":"exactly_one","display_name":"初始变量、函数及需要依次计算的公式"}],"provides":[{"key":"normalized_expression_request","type":"era.expression.request.normalized","display_name":"已检查并整理好的公式计算请求"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.request":["由调用方提供，公式引擎只使用本次资料计算，不自行读取聊天。"]},"output_semantics":{"normalized_expression_request":["包含变量起点、函数定义、操作和可重复随机要求，供整个计算流程使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/validate_request.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.syntax","era.expression.types"],
  "capabilities": [],
  "tags": ["表达式工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.validate_request",
  "node_type": "vibeflow.node"
});
