import {defineNode} from "@vibeflow/plugin";

export const era_macro_adapt_output = defineNode({
  "display_name": "交出完成宏替换的文字",
  "description": "接收宏替换流程拼好的整段文字，原样交给外层流程。外层据此返回最终显示或提示内容，本环节不再查找宏或改变文字。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.macro.replacement.internal","cardinality":"exactly_one","display_name":"已完成逐个宏替换的完整文字"}],"provides":[{"key":"macro.replacement.rendered","type":"era.macro.replacement.candidate","display_name":"本次分支得到的最终文字"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.macro.replacement.internal":["供替换子流程交回外层统一文字出口。"]},"output_semantics":{"macro.replacement.rendered":["可能来自直接保留或宏替换分支，每次实际采用其中一份。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"source":{"kind":"file","ref":"nodes/adapt_output.ts","export":"run"}}],
  "base_libs": [],
  "tags": ["宏处理"],
  "rulesets": ["vibeflow.process"],
  "id": "era.macro.adapt_output",
  "node_type": "vibeflow.node"
});
