import {defineNode} from "@vibeflow/plugin";

export const era_expression_terminal = defineNode({
  "display_name": "标记公式计算的开始或结束",
  "description": "标明公式计算流程的开始或结束位置。变量计算和结果整理由图中的处理步骤完成，计算结果通过流程出口交给调用方。",
  "version": "1.0.0",
  "flow_kind": "terminal",
  "contract": {"requires":[],"provides":[],"params_schema":{},"params_defaults":{},"input_semantics":{},"output_semantics":{}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/terminal.ts","export":"run"}}],
  "base_libs": [],
  "tags": ["表达式工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.terminal",
  "node_type": "vibeflow.node"
});
