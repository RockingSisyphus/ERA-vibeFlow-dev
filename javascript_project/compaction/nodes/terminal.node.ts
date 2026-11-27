import {defineNode} from "@vibeflow/plugin";

export const era_command_compaction_terminal = defineNode({
  "display_name": "标记指令压缩的开始或结束",
  "description": "标明消息指令压缩流程的开始或结束位置。查找指令、尝试缩短和效果比较分别由图中的步骤完成。",
  "version": "1.0.0",
  "flow_kind": "terminal",
  "contract": {"requires":[],"provides":[],"params_schema":{},"params_defaults":{},"input_semantics":{},"output_semantics":{}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/terminal.ts","export":"run"}}],
  "base_libs": [],
  "tags": ["ERA 命令压缩"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command_compaction.terminal",
  "node_type": "vibeflow.node"
});
