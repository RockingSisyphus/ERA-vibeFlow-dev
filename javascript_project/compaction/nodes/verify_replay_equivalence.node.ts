import {defineNode} from "@vibeflow/plugin";

export const era_command_compaction_verify_replay_equivalence = defineNode({
  "display_name": "比较当前段缩短前后的实际效果",
  "description": "从同一变量、函数和随机起点执行缩短方案，与原段结果比较。只有结果和相关问题保持一致才采用；指令格式无效、效果不同或没有合适方案时保留原文及原因。",
  "version": "1.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.command_compaction.candidate","cardinality":"exactly_one","display_name":"当前段提出的缩短指令方案"}],"provides":[{"key":"verified","type":"era.command_compaction.verified","display_name":"当前段或整条消息的压缩确认结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.command_compaction.candidate":["还需从同一起点实际执行并与原文比较，才能决定采用。"]},"output_semantics":{"verified":["包含可采用文字或保留原文的原因，以及真实变量和随机结果。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/verify_replay_equivalence.ts","export":"run"}}],
  "base_libs": ["era.command_compaction.stages"],
  "capabilities": [],
  "tags": ["ERA 命令压缩"],
  "rulesets": ["vibeflow.process"],
  "id": "era.command_compaction.verify_replay_equivalence",
  "node_type": "vibeflow.node"
});
