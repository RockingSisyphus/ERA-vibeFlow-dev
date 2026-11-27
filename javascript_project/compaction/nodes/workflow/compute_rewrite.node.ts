import {defineNode} from "@vibeflow/plugin";
export const Step0=defineNode({
  "id": "era.migration.compaction.rewrite.workflow.prepare",
  "node_type": "vibeflow.node",
  "display_name": "准备本段工作并判断是否需要调用",
  "description": "本步骤用于“生成缩短方案并取得公式改写结果”：按依赖与作用范围寻找可安全缩短的连续指令，只在候选需要公式计算时提出请求；不能证明安全的内容保留原文。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.command_compaction.symbols",
        "cardinality": "exactly_one",
        "display_name": "变量、函数、随机结果的依赖与改写限制"
      }
    ],
    "provides": [
      {
        "key": "state",
        "type": "era.migration.compaction.rewrite.state",
        "display_name": "仅保留在当前工作流的业务进度"
      },
      {
        "key": "needs_call",
        "type": "era.migration.compaction.rewrite.route",
        "display_name": "当前是否需要实际跨流程调用"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.command_compaction.symbols": [
        "变量、函数、随机结果的依赖与改写限制"
      ]
    },
    "output_semantics": {
      "state": [
        "仅保留在当前工作流的业务进度"
      ],
      "needs_call": [
        "当前是否需要实际跨流程调用"
      ]
    }
  },
  "base_libs": [
    "era.command_compaction.stages",
    "era.command_compaction.engine",
    "era.workflow.progress"
  ],
  "rulesets": [
    "vibeflow.process"
  ],
  "implementation_files": [
    "../rewrite_safe_regions.ts"
  ],
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "completion": "immediate",
      "source": {
        "kind": "file",
        "ref": "nodes/workflow/compute_rewrite.ts",
        "export": "Prepare"
      }
    }
  ]
});
export const Step1=defineNode({
  "id": "era.migration.compaction.rewrite.workflow.skip_call",
  "node_type": "vibeflow.node",
  "display_name": "无需跨流程调用，直接保留本段结果",
  "description": "本步骤用于“生成缩短方案并取得公式改写结果”：普通赋值、无候选或已发现输入问题时不调用目标，按原语义继续处理或返回诊断。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.migration.compaction.rewrite.state",
        "cardinality": "exactly_one",
        "display_name": "仅保留在当前工作流的业务进度"
      }
    ],
    "provides": [
      {
        "key": "skipped_state",
        "type": "era.migration.compaction.rewrite.final",
        "display_name": "本段全部原生调用完成后的业务进度"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.migration.compaction.rewrite.state": [
        "仅保留在当前工作流的业务进度"
      ]
    },
    "output_semantics": {
      "skipped_state": [
        "本段全部原生调用完成后的业务进度"
      ]
    }
  },
  "base_libs": [
    "era.command_compaction.stages",
    "era.command_compaction.engine",
    "era.workflow.progress"
  ],
  "rulesets": [
    "vibeflow.process"
  ],
  "implementation_files": [
    "../rewrite_safe_regions.ts"
  ],
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "completion": "immediate",
      "source": {
        "kind": "file",
        "ref": "nodes/workflow/compute_rewrite.ts",
        "export": "Skip"
      }
    }
  ]
});
export const Step2=defineNode({
  "id": "era.migration.compaction.rewrite.workflow.finish",
  "node_type": "vibeflow.node",
  "display_name": "交出本段最终业务结果",
  "description": "本步骤用于“生成缩短方案并取得公式改写结果”：读取本地完成进度，按原合同形成变量、诊断、函数候选或压缩结果；提交、保存和是否采用仍由原调用方决定。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.migration.compaction.rewrite.final",
        "cardinality": "exactly_one",
        "display_name": "本段全部原生调用完成后的业务进度"
      }
    ],
    "provides": [
      {
        "key": "candidate",
        "type": "era.command_compaction.candidate",
        "display_name": "当前段提出的缩短指令方案"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.migration.compaction.rewrite.final": [
        "本段全部原生调用完成后的业务进度"
      ]
    },
    "output_semantics": {
      "candidate": [
        "当前段提出的缩短指令方案"
      ]
    }
  },
  "base_libs": [
    "era.command_compaction.stages",
    "era.command_compaction.engine",
    "era.workflow.progress"
  ],
  "rulesets": [
    "vibeflow.process"
  ],
  "implementation_files": [
    "../rewrite_safe_regions.ts"
  ],
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "completion": "immediate",
      "source": {
        "kind": "file",
        "ref": "nodes/workflow/compute_rewrite.ts",
        "export": "Finish"
      }
    }
  ]
});
export const Step3=defineNode({
  "id": "era.migration.compaction.rewrite.workflow.prepare_request",
  "node_type": "vibeflow.node",
  "display_name": "整理当前这一项纯数据请求",
  "description": "本步骤用于“完成一次原生同步调用并继续业务计算”：按依赖与作用范围寻找可安全缩短的连续指令，只在候选需要公式计算时提出请求；不能证明安全的内容保留原文。 仅输出目标入口需要的纯数据字段，不传完整控制状态。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.migration.compaction.rewrite.state",
        "cardinality": "exactly_one",
        "display_name": "仅保留在当前工作流的业务进度"
      }
    ],
    "provides": [
      {
        "key": "payload",
        "type": "era.workflow.inputs",
        "display_name": "目标入口的完整纯数据输入"
      },
      {
        "key": "retained_state",
        "type": "era.migration.compaction.rewrite.state.pending",
        "display_name": "留在调用方、等待接回结果的业务进度"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.migration.compaction.rewrite.state": [
        "仅保留在当前工作流的业务进度"
      ]
    },
    "output_semantics": {
      "payload": [
        "目标入口的完整纯数据输入"
      ],
      "retained_state": [
        "留在调用方、等待接回结果的业务进度"
      ]
    }
  },
  "base_libs": [
    "era.command_compaction.stages",
    "era.command_compaction.engine",
    "era.workflow.progress"
  ],
  "rulesets": [
    "vibeflow.process"
  ],
  "implementation_files": [
    "../rewrite_safe_regions.ts"
  ],
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "completion": "immediate",
      "source": {
        "kind": "file",
        "ref": "nodes/workflow/compute_rewrite.ts",
        "export": "Request"
      }
    }
  ]
});
export const Step4=defineNode({
  "id": "era.migration.compaction.rewrite.workflow.accept_response",
  "node_type": "vibeflow.node",
  "display_name": "接回结果并寻找下一次调用",
  "description": "本步骤用于“完成一次原生同步调用并继续业务计算”：把目标结果放回原计算位置，保留诊断、随机进度和原顺序；推进纯计算直到下一次需要调用，或标记整段完成。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.migration.compaction.rewrite.state.pending",
        "cardinality": "exactly_one",
        "display_name": "仅保留在当前工作流的业务进度"
      },
      {
        "type": "era.workflow.outputs",
        "cardinality": "exactly_one",
        "display_name": "本次原生同步调用的完整结果"
      }
    ],
    "provides": [
      {
        "key": "next_state",
        "type": "era.migration.compaction.rewrite.state",
        "display_name": "接回本次结果后的本地业务进度"
      },
      {
        "key": "done",
        "type": "era.migration.compaction.rewrite.done",
        "display_name": "本段是否已无后续调用"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.migration.compaction.rewrite.state.pending": [
        "仅保留在当前工作流的业务进度"
      ],
      "era.workflow.outputs": [
        "本次原生同步调用的完整结果"
      ]
    },
    "output_semantics": {
      "next_state": [
        "接回本次结果后的本地业务进度"
      ],
      "done": [
        "本段是否已无后续调用"
      ]
    }
  },
  "base_libs": [
    "era.command_compaction.stages",
    "era.command_compaction.engine",
    "era.workflow.progress"
  ],
  "rulesets": [
    "vibeflow.process"
  ],
  "implementation_files": [
    "../rewrite_safe_regions.ts"
  ],
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "completion": "immediate",
      "source": {
        "kind": "file",
        "ref": "nodes/workflow/compute_rewrite.ts",
        "export": "Accept"
      }
    }
  ]
});
