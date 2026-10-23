import {defineNode} from "@vibeflow/plugin";

export const era_macro_terminal = defineNode({
  "display_name": "标记宏处理的开始或结束",
  "description": "标明宏替换流程的开始或结束位置，帮助阅读处理顺序。宏的查找、取值和文字拼接由图中的处理步骤完成。",
  "version": "1.0.0",
  "flow_kind": "terminal",
  "contract": {"requires":[],"provides":[],"params_schema":{},"params_defaults":{},"input_semantics":{},"output_semantics":{}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"source":{"kind":"file","ref":"nodes/terminal.ts","export":"run"}}],
  "base_libs": [],
  "capabilities": [],
  "tags": ["宏处理"],
  "rulesets": ["vibeflow.process"],
  "id": "era.macro.terminal",
  "node_type": "vibeflow.node"
});
