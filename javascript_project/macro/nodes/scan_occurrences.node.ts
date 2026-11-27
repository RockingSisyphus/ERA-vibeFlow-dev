import {defineNode} from "@vibeflow/plugin";

export const era_macro_scan_occurrences = defineNode({
  "display_name": "找出文字中需要替换的位置",
  "description": "按本次处理模式，找出普通变量宏或事先标记为稍后替换的内容，记录它们在文字中的位置。遇到无法识别的延迟标记时保留原文；找到的位置交给取值步骤，原文字此时还没有改变。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.macro.substring.for_replace","cardinality":"exactly_one","display_name":"含本次需要替换标记的文字"},{"type":"era.macro.snapshot","cardinality":"exactly_one","display_name":"本次整段文字共用的变量快照"}],"provides":[{"key":"macro.occurrence_plan","type":"era.macro.occurrence_plan","display_name":"各个宏在原文中的位置和识别结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.macro.substring.for_replace":["宏扫描和拼接均以这段文字为准，其他内容保持原样。"],"era.macro.snapshot":["同一轮宏替换均从此处取值，区分资料缺失与变量本身缺项。"]},"output_semantics":{"macro.occurrence_plan":["供按正确位置读取变量并填回，损坏延迟标记保留原文。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"source":{"kind":"file","ref":"nodes/scan_occurrences.ts","export":"run"}}],
  "base_libs": ["era.macro.runtime"],
  "tags": ["宏处理"],
  "rulesets": ["vibeflow.process"],
  "id": "era.macro.scan_occurrences",
  "node_type": "vibeflow.node"
});
