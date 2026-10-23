import {defineNode} from "@vibeflow/plugin";

export const era_tavern_runtime_take_authors = defineNode({
  "id": "era.tavern.runtime.take_authors",
  "node_type": "vibeflow.node",
  "display_name": "等待并取出下一项作者函数调用",
  "description": "等待本实例作者队列出现任务，取出最早安排的调用交给作者执行流程。实例停止时改走结束分支；每次作者调用完成后才继续取下一项。",
  "flow_kind": "decision",
  "rulesets": [
    "vibeflow.data_store"
  ],
  "contract": {
    "requires": [
      {
        "type": "era.tavern.call.frame",
        "cardinality": "exactly_one",
        "display_name": "等待并取出下一项作者函数调用的请求和已有进度"
      }
    ],
    "provides": [
      {
        "key": "era_tavern_runtime_take_authors_frame",
        "type": "era.tavern.call.frame",
        "display_name": "等待并取出下一项作者函数调用的处理进度及结果"
      },
      {
        "key": "era_tavern_runtime_take_authors_route",
        "type": "era.tavern.route",
        "display_name": "按当前事实选出的处理方向"
      }
    ],
    "params_schema": {
      "outputKeys": {
        "type": "object"
      }
    },
    "params_defaults": {
      "outputKeys": {
        "frame": "era_tavern_runtime_take_authors_frame",
        "route": "era_tavern_runtime_take_authors_route"
      }
    },
    "input_semantics": {
      "era.tavern.call.frame": [
        "保留“等待并取出下一项作者函数调用”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"
      ]
    },
    "output_semantics": {
      "era_tavern_runtime_take_authors_frame": [
        "保留“等待并取出下一项作者函数调用”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"
      ],
      "era_tavern_runtime_take_authors_route": [
        "这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"
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
      "completion": "suspend",
      "source": {
        "kind": "file",
        "ref": "nodes/runtime/branches.ts",
        "export": "TakeAuthor"
      }
    }
  ],
  "base_libs": [
    "era.tavern.frames",
    "era.tavern.resources"
  ]
});

export const era_tavern_runtime_take_notifications = defineNode({
  "id": "era.tavern.runtime.take_notifications",
  "node_type": "vibeflow.node",
  "display_name": "等待下一条通知完成或收尾记录",
  "description": "等待本实例通知完成队列，区分单条通知结果与整组收尾任务，再交给对应处理。实例停止时结束本职责分支，通知未完成的顺序不会妨碍已经完成项进入队列。",
  "flow_kind": "decision",
  "rulesets": [
    "vibeflow.data_store"
  ],
  "contract": {
    "requires": [
      {
        "type": "era.tavern.call.frame",
        "cardinality": "exactly_one",
        "display_name": "等待下一条通知完成或收尾记录的请求和已有进度"
      }
    ],
    "provides": [
      {
        "key": "era_tavern_runtime_take_notifications_frame",
        "type": "era.tavern.call.frame",
        "display_name": "等待下一条通知完成或收尾记录的处理进度及结果"
      },
      {
        "key": "era_tavern_runtime_take_notifications_route",
        "type": "era.tavern.route",
        "display_name": "按当前事实选出的处理方向"
      }
    ],
    "params_schema": {
      "outputKeys": {
        "type": "object"
      }
    },
    "params_defaults": {
      "outputKeys": {
        "frame": "era_tavern_runtime_take_notifications_frame",
        "route": "era_tavern_runtime_take_notifications_route"
      }
    },
    "input_semantics": {
      "era.tavern.call.frame": [
        "保留“等待下一条通知完成或收尾记录”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"
      ]
    },
    "output_semantics": {
      "era_tavern_runtime_take_notifications_frame": [
        "保留“等待下一条通知完成或收尾记录”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"
      ],
      "era_tavern_runtime_take_notifications_route": [
        "这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"
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
      "completion": "suspend",
      "source": {
        "kind": "file",
        "ref": "nodes/runtime/branches.ts",
        "export": "TakeNotification"
      }
    }
  ],
  "base_libs": [
    "era.tavern.frames",
    "era.tavern.resources"
  ]
});

export const era_tavern_runtime_take_timers = defineNode({
  "id": "era.tavern.runtime.take_timers",
  "node_type": "vibeflow.node",
  "display_name": "选出最近需要处理的有效期限",
  "description": "清除已经取消的计时安排，从剩余项选出最早期限。将期限和当前安排版本交给等待步骤；实例停止时结束，安排改变时会重新选择。",
  "flow_kind": "decision",
  "rulesets": [
    "vibeflow.data_store"
  ],
  "contract": {
    "requires": [
      {
        "type": "era.tavern.call.frame",
        "cardinality": "exactly_one",
        "display_name": "选出最近需要处理的有效期限的请求和已有进度"
      }
    ],
    "provides": [
      {
        "key": "era_tavern_runtime_take_timers_frame",
        "type": "era.tavern.call.frame",
        "display_name": "选出最近需要处理的有效期限的处理进度及结果"
      },
      {
        "key": "era_tavern_runtime_take_timers_route",
        "type": "era.tavern.route",
        "display_name": "按当前事实选出的处理方向"
      }
    ],
    "params_schema": {
      "outputKeys": {
        "type": "object"
      }
    },
    "params_defaults": {
      "outputKeys": {
        "frame": "era_tavern_runtime_take_timers_frame",
        "route": "era_tavern_runtime_take_timers_route"
      }
    },
    "input_semantics": {
      "era.tavern.call.frame": [
        "保留“选出最近需要处理的有效期限”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"
      ]
    },
    "output_semantics": {
      "era_tavern_runtime_take_timers_frame": [
        "保留“选出最近需要处理的有效期限”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"
      ],
      "era_tavern_runtime_take_timers_route": [
        "这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"
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
        "export": "SelectTimer"
      }
    }
  ],
  "base_libs": [
    "era.tavern.frames",
    "era.tavern.resources"
  ]
});
