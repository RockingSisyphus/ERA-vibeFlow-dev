import {defineNode} from "@vibeflow/plugin";

export const era_macro_resolve_occurrences = defineNode({
  "display_name": "为每个宏读取对应变量",
  "description": "根据宏中写明的变量路径，从本次选定的变量资料取值，也支持读取全部变量或包含内部记录的视图。资料缺失或延迟标记损坏时保留原文；资料可用但找不到该变量时记为空值，供文字拼接时处理。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.macro.occurrence_plan","cardinality":"exactly_one","display_name":"各个宏在原文中的位置和识别结果"}],"provides":[{"key":"macro.resolved_occurrences","type":"era.macro.resolved_occurrences","display_name":"每个宏的变量值或保留、空值决定"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.macro.occurrence_plan":["供按正确位置读取变量并填回，损坏延迟标记保留原文。"]},"output_semantics":{"macro.resolved_occurrences":["已按本次快照取值，供格式化和文字拼接使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"source":{"kind":"file","ref":"nodes/resolve_occurrences.ts","export":"run"}}],
  "base_libs": ["era.macro.runtime"],
  "tags": ["宏处理"],
  "rulesets": ["vibeflow.process"],
  "id": "era.macro.resolve_occurrences",
  "node_type": "vibeflow.node"
});
