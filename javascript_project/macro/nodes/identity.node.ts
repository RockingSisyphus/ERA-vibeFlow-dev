import {defineNode} from "@vibeflow/plugin";

export const era_macro_identity = defineNode({
  "display_name": "直接使用无需替换的文字",
  "description": "本次文字没有需要展开的变量宏时，直接采用检查步骤整理好的文字。提示词此前清除的内部操作内容仍保持清除，结果与完成宏替换的分支一起交给统一出口。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.macro.substring.checked","cardinality":"exactly_one","display_name":"按本次用途整理并检查后的文字"}],"provides":[{"key":"macro.replacement.identity","type":"era.macro.replacement.candidate","display_name":"本次分支得到的最终文字"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.macro.substring.checked":["已完成模式检查，提示词中的内部操作内容可能已清理，供直接返回或继续宏替换。"]},"output_semantics":{"macro.replacement.identity":["可能来自直接保留或宏替换分支，每次实际采用其中一份。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"source":{"kind":"file","ref":"nodes/identity.ts","export":"run"}}],
  "base_libs": [],
  "tags": ["宏处理"],
  "rulesets": ["vibeflow.process"],
  "id": "era.macro.identity",
  "node_type": "vibeflow.node"
});
