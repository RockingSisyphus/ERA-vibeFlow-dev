import {defineNode} from "@vibeflow/plugin";

export const era_command_compaction_render_compaction_result = defineNode({
  "display_name": "返回已确认的消息与压缩结论",
  "description": "接收已经确认的完整消息结果，将可采用的文字、最终变量和函数、随机进度及保留原文的原因返回调用方。由调用方决定是否保存到聊天，此处完成计算结果交付。",
  "version": "1.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command_compaction.verified","cardinality":"exactly_one","display_name":"当前段或整条消息的压缩确认结果"}],"provides":[{"key":"compaction_response","type":"era.command_compaction.response","display_name":"确认后的消息文字及指令压缩结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command_compaction.verified":["包含可采用文字或保留原文的原因，以及真实变量和随机结果。"]},"output_semantics":{"compaction_response":["含最终变量、函数、问题和保留原文原因，是否保存由调用方决定。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/render_compaction_result.ts","export":"run"}}],
  "base_libs": ["era.command_compaction.engine"],
  "capabilities": [],
  "tags": ["ERA 命令压缩"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command_compaction.render_compaction_result",
  "node_type": "vibeflow.node"
});
