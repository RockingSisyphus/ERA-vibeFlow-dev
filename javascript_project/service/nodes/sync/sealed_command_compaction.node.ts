import {defineNode} from "@vibeflow/plugin";

export const prepareCandidates = defineNode({
  "id": "era.sealed_command_compaction.prepare_candidates",
  "node_type": "vibeflow.node",
  "version": "1.0.0",
  "display_name": "为已完成历史准备压缩及比较任务",
  "description": "对已完成处理的历史正文生成可能更短的指令方案，保留各消息原有变量、函数和随机来源。建立逐份比较进度，供正式操作流程验证是否可以采用。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.expression.command.result",
        "cardinality": "exactly_one",
        "display_name": "消息处理后待核对的历史压缩资料"
      }
    ],
    "provides": [
      {
        "key": "candidates",
        "type": "era.command_compaction.replay.state",
        "display_name": "当前历史压缩方案及验证进度"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.expression.command.result": [
        "保留当前历史状态及可能缩短的正文，供使用正式操作规则逐项比较效果。"
      ]
    },
    "output_semantics": {
      "candidates": [
        "保存候选原始起点、已比较记录和当前位置，供逐份重算。"
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
        "export": "prepareCandidates"
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
