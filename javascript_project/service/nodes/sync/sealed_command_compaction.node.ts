import {defineNode} from "@vibeflow/plugin";

export const publishCandidates = defineNode({
  "id": "era.sealed_command_compaction.publish_candidates",
  "node_type": "vibeflow.node",
  "version": "1.0.0",
  "display_name": "把通过比较的缩短正文合回历史结果",
  "description": "接收各份压缩方案的实际验证结论，将效果一致的缩短正文及处理标记合入同步结果。无变化或未通过的部分保留原文，相关历史记录按实际采用内容更新。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.command_compaction.replay.state.next",
        "cardinality": "exactly_one",
        "display_name": "本份比较后的下一方案及累计结论"
      }
    ],
    "provides": [
      {
        "key": "command_compaction_result",
        "type": "era.command_compaction.result",
        "display_name": "已确认历史压缩后可采用的正文结果"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.command_compaction.replay.state.next": [
        "供继续验证后续方案，或在遍历结束后决定采用哪些缩短正文。"
      ]
    },
    "output_semantics": {
      "command_compaction_result": [
        "包含验证结论及应保留的历史状态，供合入消息同步结果。"
      ]
    }
  },
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser"
      ],
      "completion": "immediate",
      "source": {
        "kind": "file",
        "ref": "nodes/sync/compaction_replay.ts",
        "export": "publishCandidates"
      }
    }
  ],
  "base_libs": [
    "era.service.command_compaction"
  ],
  "rulesets": [
    "vibeflow.process"
  ]
});
