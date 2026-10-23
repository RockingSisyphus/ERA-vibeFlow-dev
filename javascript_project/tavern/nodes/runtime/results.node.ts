import {defineNode} from "@vibeflow/plugin";

export const era_tavern_runtime_advance = defineNode({
  "id": "era.tavern.runtime.advance",
  "node_type": "vibeflow.node",
  "display_name": "本轮处理完成后继续等待下一项",
  "description": "接收当前职责一次实际处理结束的结果，将同一实例交回外层循环并标记继续。下一轮再读取该职责队列，保持任务顺序及实例归属。",
  "flow_kind": "data_store",
  "rulesets": [
    "vibeflow.data_store"
  ],
  "contract": {
    "requires": [
      {
        "type": "era.tavern.call.frame",
        "cardinality": "exactly_one",
        "display_name": "本轮处理完成后继续等待下一项的请求和已有进度"
      },
      {
        "type": "era.tavern.task.finished",
        "cardinality": "exactly_one",
        "display_name": "当前职责已真实完成或退出的确认"
      }
    ],
    "provides": [
      {
        "key": "era_tavern_runtime_advance_frame",
        "type": "era.tavern.runtime.state.next",
        "display_name": "本轮处理完成后继续等待下一项的处理进度及结果"
      },
      {
        "key": "era_tavern_runtime_advance_done",
        "type": "era.tavern.runtime.done",
        "display_name": "本轮遍历或职责处理是否已经结束"
      }
    ],
    "params_schema": {
      "outputKeys": {
        "type": "object"
      }
    },
    "params_defaults": {
      "outputKeys": {
        "frame": "era_tavern_runtime_advance_frame",
        "done": "era_tavern_runtime_advance_done"
      }
    },
    "input_semantics": {
      "era.tavern.call.frame": [
        "保留“本轮处理完成后继续等待下一项”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"
      ],
      "era.tavern.task.finished": [
        "记录当前职责一次工作或整个分支已经实际结束，供循环继续或汇合确认。"
      ]
    },
    "output_semantics": {
      "era_tavern_runtime_advance_frame": [
        "保留“本轮处理完成后继续等待下一项”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"
      ],
      "era_tavern_runtime_advance_done": [
        "表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"
      ]
    }
  },
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
        "ref": "nodes/runtime/branches.ts",
        "export": "Advance"
      }
    }
  ],
  "base_libs": [
    "era.tavern.frames",
    "era.tavern.resources"
  ]
});

export const era_tavern_runtime_end_loop = defineNode({
  "id": "era.tavern.runtime.end_loop",
  "node_type": "vibeflow.node",
  "display_name": "结束当前长期职责分支",
  "description": "实例停止后，将当前作者、通知或计时循环标为结束，并交出该分支已退出的确认。最终汇合据此等待所有职责真正结束。",
  "flow_kind": "data_store",
  "rulesets": [
    "vibeflow.data_store"
  ],
  "contract": {
    "requires": [
      {
        "type": "era.tavern.call.frame",
        "cardinality": "exactly_one",
        "display_name": "结束当前长期职责分支的请求和已有进度"
      }
    ],
    "provides": [
      {
        "key": "era_tavern_runtime_end_loop_frame",
        "type": "era.tavern.runtime.state.next",
        "display_name": "结束当前长期职责分支的处理进度及结果"
      },
      {
        "key": "era_tavern_runtime_end_loop_done",
        "type": "era.tavern.runtime.done",
        "display_name": "本轮遍历或职责处理是否已经结束"
      }
    ],
    "params_schema": {
      "outputKeys": {
        "type": "object"
      }
    },
    "params_defaults": {
      "outputKeys": {
        "frame": "era_tavern_runtime_end_loop_frame",
        "done": "era_tavern_runtime_end_loop_done"
      }
    },
    "input_semantics": {
      "era.tavern.call.frame": [
        "保留“结束当前长期职责分支”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"
      ]
    },
    "output_semantics": {
      "era_tavern_runtime_end_loop_frame": [
        "保留“结束当前长期职责分支”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"
      ],
      "era_tavern_runtime_end_loop_done": [
        "表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"
      ]
    }
  },
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
        "ref": "nodes/runtime/branches.ts",
        "export": "EndLoop"
      }
    }
  ],
  "base_libs": [
    "era.tavern.frames",
    "era.tavern.resources"
  ]
});

export const era_tavern_runtime_collect = defineNode({
  "id": "era.tavern.runtime.collect",
  "node_type": "vibeflow.node",
  "display_name": "确认五条职责分支都已实际退出",
  "description": "收集资源管理、主服务、作者调用、通知和计时五条分支的退出确认。五条齐全才返回实例停止结果，使取消请求与实际退出明确区分。",
  "flow_kind": "data_store",
  "rulesets": [
    "vibeflow.data_store"
  ],
  "contract": {
    "requires": [
      {
        "type": "era.tavern.task.finished",
        "cardinality": "all",
        "display_name": "当前职责已真实完成或退出的确认"
      }
    ],
    "provides": [
      {
        "key": "era_tavern_runtime_collect_frame",
        "type": "era.tavern.runtime.result",
        "display_name": "五条职责和资源清理完成后的停止确认"
      }
    ],
    "params_schema": {
      "outputKeys": {
        "type": "object"
      }
    },
    "params_defaults": {
      "outputKeys": {
        "frame": "era_tavern_runtime_collect_frame"
      }
    },
    "input_semantics": {
      "era.tavern.task.finished": [
        "记录当前职责一次工作或整个分支已经实际结束，供循环继续或汇合确认。"
      ]
    },
    "output_semantics": {
      "era_tavern_runtime_collect_frame": [
        "五条运行职责及资源清理结束后，向调用方确认本次实例已经停止。"
      ]
    }
  },
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
        "ref": "nodes/runtime/branches.ts",
        "export": "Collect"
      }
    }
  ],
  "base_libs": [
    "era.tavern.frames",
    "era.tavern.resources"
  ]
});

export const era_tavern_runtime_dispatch = defineNode({
  "id": "era.tavern.runtime.dispatch",
  "node_type": "vibeflow.node",
  "display_name": "让五条职责分支使用同一实例",
  "description": "把本次实例资料同时交给资源、主服务、作者、通知和计时分支。各分支处理各自职责，最后统一等待全部退出。",
  "flow_kind": "data_store",
  "rulesets": [
    "vibeflow.data_store"
  ],
  "contract": {
    "requires": [
      {
        "type": "era.tavern.call.frame",
        "cardinality": "exactly_one",
        "display_name": "让五条职责分支使用同一实例的请求和已有进度"
      }
    ],
    "provides": [
      {
        "key": "era_tavern_runtime_dispatch_frame",
        "type": "era.tavern.call.frame",
        "display_name": "让五条职责分支使用同一实例的处理进度及结果"
      }
    ],
    "params_schema": {
      "outputKeys": {
        "type": "object"
      }
    },
    "params_defaults": {
      "outputKeys": {
        "frame": "era_tavern_runtime_dispatch_frame"
      }
    },
    "input_semantics": {
      "era.tavern.call.frame": [
        "保留“让五条职责分支使用同一实例”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"
      ]
    },
    "output_semantics": {
      "era_tavern_runtime_dispatch_frame": [
        "保留“让五条职责分支使用同一实例”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"
      ]
    }
  },
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
        "ref": "nodes/runtime/branches.ts",
        "export": "Dispatch"
      }
    }
  ],
  "base_libs": [
    "era.tavern.frames",
    "era.tavern.resources"
  ]
});
