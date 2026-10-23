import {defineNode} from "@vibeflow/plugin";

export const era_macro_quick_check = defineNode({
  "display_name": "判断这段文字需要替换哪些宏",
  "description": "接收聊天文字或发给模型的提示词，按本次用途检查可替换的 ERA 变量标记。提示词会先去掉内部操作内容；没有可替换标记时直接保留整理后的文字，有标记时再读取本次提供的变量资料。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.macro.substring","cardinality":"exactly_one","display_name":"待处理的聊天或提示词文字"},{"type":"era.macro.stored_stat","cardinality":"exactly_one","display_name":"本次提供的已保存变量资料"}],"provides":[{"key":"macro.checked_substring","type":"era.macro.substring.checked","display_name":"按本次用途整理并检查后的文字"},{"key":"macro.checked_stored_stat","type":"era.macro.stored_stat.checked","display_name":"本次检查后继续使用的变量资料"},{"key":"macro.contains","type":"era.macro.contains","display_name":"本次文字是否包含需要替换的宏"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.macro.substring":["来自本次宏调用，供检查可替换标记并保留其余文字。"],"era.macro.stored_stat":["供宏在同一份读数上取值，资料缺失时按原规则保留文字。"]},"output_semantics":{"macro.checked_substring":["已完成模式检查，提示词中的内部操作内容可能已清理，供直接返回或继续宏替换。"],"macro.checked_stored_stat":["随本次文字一起传递，供需要替换宏时选定统一读数。"],"macro.contains":["供选择直接返回整理后文字，或进入快照取值和替换。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"source":{"kind":"file","ref":"nodes/quick_check.ts","export":"run"}}],
  "base_libs": ["era.macro.runtime"],
  "capabilities": [],
  "tags": ["宏处理"],
  "rulesets": ["vibeflow.process"],
  "id": "era.macro.quick_check",
  "node_type": "vibeflow.node"
});
