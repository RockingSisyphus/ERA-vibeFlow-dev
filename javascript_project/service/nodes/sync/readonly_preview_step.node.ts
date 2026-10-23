import {defineNode} from "@vibeflow/plugin";

export const selectPosition = defineNode({
  "id": "era.readonly_preview_step.select_position",
  "node_type": "vibeflow.node",
  "version": "1.0.0",
  "display_name": "选择只读历史重算的下一段内容",
  "description": "根据历史和消息位置判断当前是否有变量指令可计算，还是应略过普通内容、结束或报告失败。供只读预演按真实消息顺序推进，生成下一阶段需要的变量起点。",
  "flow_kind": "decision",
  "contract": {
    "requires": [
      {
        "type": "era.sync.preview.state",
        "cardinality": "exactly_one",
        "display_name": "只读历史重算的当前位置和变量"
      }
    ],
    "provides": [
      {
        "key": "position",
        "type": "era.sync.preview.state",
        "display_name": "只读历史重算的当前位置和变量"
      },
      {
        "key": "route",
        "type": "era.sync.preview.state.route",
        "display_name": "当前位置应计算指令还是直接推进"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.sync.preview.state": [
        "记录预演正在处理的消息、正文位置、变量和函数，供按顺序还原下一生成阶段的起点。"
      ]
    },
    "output_semantics": {
      "position": [
        "记录预演正在处理的消息、正文位置、变量和函数，供按顺序还原下一生成阶段的起点。"
      ],
      "route": [
        "用于只读历史重算选择正式操作计算或非指令推进，不执行作者函数。"
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
        "ref": "nodes/sync/readonly_preview.ts",
        "export": "selectPosition"
      }
    }
  ],
  "base_libs": [
    "era.service.readonly_preview"
  ],
  "rulesets": [
    "vibeflow.process"
  ]
});

export const prepareOperations = defineNode({
  "id": "era.readonly_preview_step.prepare_operations",
  "node_type": "vibeflow.node",
  "version": "1.0.0",
  "display_name": "准备只读重算当前位置的指令",
  "description": "从历史预演当前的变量、函数、历史记录和随机位置出发，整理本段变量及函数指令。交给与正式消息相同的操作流程，结果只用于还原起点。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.sync.preview.state",
        "cardinality": "exactly_one",
        "display_name": "只读历史重算的当前位置和变量"
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
      "era.sync.preview.state": [
        "记录预演正在处理的消息、正文位置、变量和函数，供按顺序还原下一生成阶段的起点。"
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
        "ref": "nodes/sync/readonly_preview.ts",
        "export": "prepareOperations"
      }
    }
  ],
  "base_libs": [
    "era.service.readonly_preview"
  ],
  "rulesets": [
    "vibeflow.process"
  ]
});

export const acceptOperations = defineNode({
  "id": "era.readonly_preview_step.accept_operations",
  "node_type": "vibeflow.node",
  "version": "1.0.0",
  "display_name": "采用只读指令结果并推进正文",
  "description": "接收只读重算得到的变量、函数、历史、问题和随机进度，合入预演状态并移到下一正文位置。遇到失败明确结束，供下一生成阶段得到可信的起点或原因。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.sync.preview.state",
        "cardinality": "exactly_one",
        "display_name": "只读历史重算的当前位置和变量"
      },
      {
        "type": "era.command.operation.result",
        "cardinality": "exactly_one",
        "display_name": "指定范围所有操作算出的完整状态"
      }
    ],
    "provides": [
      {
        "key": "accepted_state",
        "type": "era.sync.preview.state.next",
        "display_name": "只读重算后的下一位置或结束结果"
      },
      {
        "key": "accepted_done",
        "type": "era.command.operation.done",
        "display_name": "本范围的有序操作是否全部结束"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.sync.preview.state": [
        "记录预演正在处理的消息、正文位置、变量和函数，供按顺序还原下一生成阶段的起点。"
      ],
      "era.command.operation.result": [
        "包含变量、函数、历史、问题和随机使用次数，供消息应用、预演或压缩比较。"
      ]
    },
    "output_semantics": {
      "accepted_state": [
        "包含已经还原的变量及进度，未结束时继续下一段，结束或失败时交回明确结论。"
      ],
      "accepted_done": [
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
        "ref": "nodes/sync/readonly_preview.ts",
        "export": "acceptOperations"
      }
    }
  ],
  "base_libs": [
    "era.service.readonly_preview"
  ],
  "rulesets": [
    "vibeflow.process"
  ]
});

export const advancePosition = defineNode({
  "id": "era.readonly_preview_step.advance_position",
  "node_type": "vibeflow.node",
  "version": "1.0.0",
  "display_name": "略过无需计算的正文或结束预演",
  "description": "按历史规则推进当前没有变量指令的内容，并在到达结尾或失败时交出终态。只读预演不执行作者函数，让生成起点重建保持为可控的历史计算。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.sync.preview.state",
        "cardinality": "exactly_one",
        "display_name": "只读历史重算的当前位置和变量"
      }
    ],
    "provides": [
      {
        "key": "advanced_state",
        "type": "era.sync.preview.state.next",
        "display_name": "只读重算后的下一位置或结束结果"
      },
      {
        "key": "advanced_done",
        "type": "era.command.operation.done",
        "display_name": "本范围的有序操作是否全部结束"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.sync.preview.state": [
        "记录预演正在处理的消息、正文位置、变量和函数，供按顺序还原下一生成阶段的起点。"
      ]
    },
    "output_semantics": {
      "advanced_state": [
        "包含已经还原的变量及进度，未结束时继续下一段，结束或失败时交回明确结论。"
      ],
      "advanced_done": [
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
        "ref": "nodes/sync/readonly_preview.ts",
        "export": "advancePosition"
      }
    }
  ],
  "base_libs": [
    "era.service.readonly_preview"
  ],
  "rulesets": [
    "vibeflow.process"
  ]
});
