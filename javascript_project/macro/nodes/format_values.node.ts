import {defineNode} from "@vibeflow/plugin";

export const era_macro_format_values = defineNode({
  "display_name": "把变量值填回原文字",
  "description": "将已经找到的变量值转换为可显示文字，放回各个宏原来的位置，保留其他文字。变量资料缺失时保留原宏；资料存在但变量缺项时填入空文字。结果供状态栏显示或模型提示使用。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.macro.resolved_occurrences","cardinality":"exactly_one","display_name":"每个宏的变量值或保留、空值决定"}],"provides":[{"key":"macro.replacement.internal","type":"era.macro.replacement.internal","display_name":"已完成逐个宏替换的完整文字"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.macro.resolved_occurrences":["已按本次快照取值，供格式化和文字拼接使用。"]},"output_semantics":{"macro.replacement.internal":["供替换子流程交回外层统一文字出口。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"source":{"kind":"file","ref":"nodes/format_values.ts","export":"run"}}],
  "base_libs": ["era.macro.runtime"],
  "capabilities": [],
  "tags": ["宏处理"],
  "rulesets": ["vibeflow.process"],
  "id": "era.macro.format_values",
  "node_type": "vibeflow.node"
});
