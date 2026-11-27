import {defineNode} from "@vibeflow/plugin";

export const era_macro_output_join = defineNode({
  "display_name": "返回本次得到的最终文字",
  "description": "接收本次实际走到的文字结果：可能是无需替换的文字，也可能是已填入变量的文字。将这份结果返回调用方，用于状态栏、聊天显示或模型提示。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.macro.replacement.candidate","cardinality":"exactly_one","display_name":"本次分支得到的最终文字"}],"provides":[{"key":"macro.replacement","type":"era.macro.replacement","display_name":"返回给调用方的宏处理文字"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.macro.replacement.candidate":["可能来自直接保留或宏替换分支，每次实际采用其中一份。"]},"output_semantics":{"macro.replacement":["供聊天显示、状态栏或模型提示使用，内容与本次实际处理分支一致。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"source":{"kind":"file","ref":"nodes/output_join.ts","export":"run"}}],
  "base_libs": [],
  "tags": ["宏处理"],
  "rulesets": ["vibeflow.process"],
  "id": "era.macro.output_join",
  "node_type": "vibeflow.node"
});
