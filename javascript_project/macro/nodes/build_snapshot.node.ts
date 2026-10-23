import {defineNode} from "@vibeflow/plugin";

export const era_macro_build_snapshot = defineNode({
  "display_name": "为整段文字选定同一份变量",
  "description": "接收已经保存的 ERA 变量，整理出普通显示和需要内部记录时使用的两份读数。调用方已经选好读数时直接采用；资料缺失时记为不可用。整段文字共用这一份资料，避免各个宏显示出不同时间的状态。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.macro.substring.checked","cardinality":"exactly_one","display_name":"按本次用途整理并检查后的文字"},{"type":"era.macro.stored_stat.checked","cardinality":"exactly_one","display_name":"本次检查后继续使用的变量资料"}],"provides":[{"key":"macro.substring_for_replace","type":"era.macro.substring.for_replace","display_name":"含本次需要替换标记的文字"},{"key":"macro.snapshot","type":"era.macro.snapshot","display_name":"本次整段文字共用的变量快照"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.macro.substring.checked":["已完成模式检查，提示词中的内部操作内容可能已清理，供直接返回或继续宏替换。"],"era.macro.stored_stat.checked":["随本次文字一起传递，供需要替换宏时选定统一读数。"]},"output_semantics":{"macro.substring_for_replace":["宏扫描和拼接均以这段文字为准，其他内容保持原样。"],"macro.snapshot":["同一轮宏替换均从此处取值，区分资料缺失与变量本身缺项。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"source":{"kind":"file","ref":"nodes/build_snapshot.ts","export":"run"}}],
  "base_libs": ["era.macro.runtime"],
  "capabilities": [],
  "tags": ["宏处理"],
  "rulesets": ["vibeflow.process"],
  "id": "era.macro.build_snapshot",
  "node_type": "vibeflow.node"
});
