import {defineNode} from "@vibeflow/plugin";

export const selectCandidate = defineNode({
  "id": "era.command_compaction_replay_step.select_candidate",
  "node_type": "vibeflow.node",
  "version": "1.0.0",
  "display_name": "取出下一份需要验证的历史压缩方案",
  "description": "从已完成历史的缩短建议中，跳过无实际变化或已有问题的项目，选出下一份可验证方案。为它准备原消息的变量、函数及随机起点；没有剩余项目时结束遍历。",
  "flow_kind": "decision",
  "contract": {
    "requires": [
      {
        "type": "era.command_compaction.replay.state",
        "cardinality": "exactly_one",
        "display_name": "当前历史压缩方案及验证进度"
      }
    ],
    "provides": [
      {
        "key": "candidate",
        "type": "era.command_compaction.replay.state",
        "display_name": "当前历史压缩方案及验证进度"
      },
      {
        "key": "route",
        "type": "era.command_compaction.replay.state.route",
        "display_name": "还有压缩方案需要验证或已经结束"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.command_compaction.replay.state": [
        "保存候选原始起点、已比较记录和当前位置，供逐份重算。"
      ]
    },
    "output_semantics": {
      "candidate": [
        "保存候选原始起点、已比较记录和当前位置，供逐份重算。"
      ],
      "route": [
        "供选择进入正式指令计算，或返回全部验证结论。"
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
        "export": "selectCandidate"
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

export const prepareOperations = defineNode({
  "id": "era.command_compaction_replay_step.prepare_operations",
  "node_type": "vibeflow.node",
  "version": "1.0.0",
  "display_name": "准备从原起点执行缩短后的指令",
  "description": "接收当前历史压缩方案，用该消息原有的变量、函数、历史和随机来源整理缩短正文中的操作。交给与正式消息相同的指令流程计算，供比较效果。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.command_compaction.replay.state",
        "cardinality": "exactly_one",
        "display_name": "当前历史压缩方案及验证进度"
      }
    ],
    "provides": [
      {
        "key": "operations",
        "type": "era.command.operation.state",
        "display_name": "有序操作、当前变量和函数及随机进度"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.command_compaction.replay.state": [
        "保存候选原始起点、已比较记录和当前位置，供逐份重算。"
      ]
    },
    "output_semantics": {
      "operations": [
        "作为正式操作循环的当前工作状态，执行后交给下一项或完整结果。"
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
        "export": "prepareOperations"
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

export const compareCandidate = defineNode({
  "id": "era.command_compaction_replay_step.compare_candidate",
  "node_type": "vibeflow.node",
  "version": "1.0.0",
  "display_name": "确认压缩方案与原消息效果相同",
  "description": "比较缩短指令的重算结果与原历史结果。变量、函数和随机使用次数一致且没有问题时接受，否则保留原文；记下结论后移到下一份方案。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.command_compaction.replay.state",
        "cardinality": "exactly_one",
        "display_name": "当前历史压缩方案及验证进度"
      },
      {
        "type": "era.command.operation.result",
        "cardinality": "exactly_one",
        "display_name": "指定范围所有操作算出的完整状态"
      }
    ],
    "provides": [
      {
        "key": "compared_state",
        "type": "era.command_compaction.replay.state.next",
        "display_name": "本份比较后的下一方案及累计结论"
      },
      {
        "key": "compared_done",
        "type": "era.command.operation.done",
        "display_name": "本范围的有序操作是否全部结束"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.command_compaction.replay.state": [
        "保存候选原始起点、已比较记录和当前位置，供逐份重算。"
      ],
      "era.command.operation.result": [
        "包含变量、函数、历史、问题和随机使用次数，供消息应用、预演或压缩比较。"
      ]
    },
    "output_semantics": {
      "compared_state": [
        "供继续验证后续方案，或在遍历结束后决定采用哪些缩短正文。"
      ],
      "compared_done": [
        "供操作循环决定继续下一项，或交出完整变量、函数、历史及随机结果。"
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
        "export": "compareCandidate"
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

export const finishCandidates = defineNode({
  "id": "era.command_compaction_replay_step.finish_candidates",
  "node_type": "vibeflow.node",
  "version": "1.0.0",
  "display_name": "交出各份历史压缩方案的验证结论",
  "description": "所有待验证方案处理完后，返回逐份接受或拒绝的记录。外层据此只采用已通过实际计算比较的缩短正文。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.command_compaction.replay.state",
        "cardinality": "exactly_one",
        "display_name": "当前历史压缩方案及验证进度"
      }
    ],
    "provides": [
      {
        "key": "finished_state",
        "type": "era.command_compaction.replay.state.next",
        "display_name": "本份比较后的下一方案及累计结论"
      },
      {
        "key": "finished_done",
        "type": "era.command.operation.done",
        "display_name": "本范围的有序操作是否全部结束"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.command_compaction.replay.state": [
        "保存候选原始起点、已比较记录和当前位置，供逐份重算。"
      ]
    },
    "output_semantics": {
      "finished_state": [
        "供继续验证后续方案，或在遍历结束后决定采用哪些缩短正文。"
      ],
      "finished_done": [
        "供操作循环决定继续下一项，或交出完整变量、函数、历史及随机结果。"
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
        "export": "finishCandidates"
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
