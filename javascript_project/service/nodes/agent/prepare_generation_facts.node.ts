import {defineNode} from "@vibeflow/plugin";

export const preparePreview = defineNode({
  "id": "era.prepare_generation_facts.prepare_preview",
  "node_type": "vibeflow.node",
  "version": "1.0.0",
  "display_name": "准备只读重算应保留的历史",
  "description": "把需要保留的消息正文、变量、函数和历史记录整理成只读重算任务。后续按原顺序计算这些内容，为下一生成阶段还原变量起点，期间不改写聊天。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.agent.baseline.state",
        "cardinality": "exactly_one",
        "display_name": "生成前已读取的资料及恢复要求"
      }
    ],
    "provides": [
      {
        "key": "preview",
        "type": "era.sync.preview.state",
        "display_name": "只读历史重算的当前位置和变量"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.agent.baseline.state": [
        "包含当前正文、配置、会话和检查问题，标明是否需要先按保留历史重建变量起点。"
      ]
    },
    "output_semantics": {
      "preview": [
        "记录预演正在处理的消息、正文位置、变量和函数，供按顺序还原下一生成阶段的起点。"
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
        "ref": "nodes/agent/prepare_generation_facts.ts",
        "export": "preparePreview"
      }
    }
  ],
  "base_libs": [
    "era.service.readonly_preview",
    "era.service.agent_flow_policy",
    "era.service.agent_generation_session",
    "era.service.mk_engine",
    "era.service.sync_work_preparation",
    "era.service.types"
  ],
  "rulesets": [
    "vibeflow.process"
  ]
});

export const finishPreview = defineNode({
  "id": "era.prepare_generation_facts.finish_preview",
  "node_type": "vibeflow.node",
  "version": "1.0.0",
  "display_name": "采用历史重算得到的生成起点",
  "description": "接收只读历史重算的结果，成功时用它更新下一生成阶段需要的变量、函数和保留正文。重算失败时返回原有原因，防止模型在未确认的历史状态上继续。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.agent.baseline.state",
        "cardinality": "exactly_one",
        "display_name": "生成前已读取的资料及恢复要求"
      },
      {
        "type": "era.sync.preview.state.next",
        "cardinality": "exactly_one",
        "display_name": "只读重算后的下一位置或结束结果"
      }
    ],
    "provides": [
      {
        "key": "restored_facts",
        "type": "era.agent.generation.facts",
        "display_name": "可用于判断生成阶段的聊天资料"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.agent.baseline.state": [
        "包含当前正文、配置、会话和检查问题，标明是否需要先按保留历史重建变量起点。"
      ],
      "era.sync.preview.state.next": [
        "包含已经还原的变量及进度，未结束时继续下一段，结束或失败时交回明确结论。"
      ]
    },
    "output_semantics": {
      "restored_facts": [
        "包含本次聊天、保留正文、配置和已恢复的变量起点或失败原因，供生成阶段选择使用。"
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
        "ref": "nodes/agent/prepare_generation_facts.ts",
        "export": "finishPreview"
      }
    }
  ],
  "base_libs": [
    "era.service.readonly_preview",
    "era.service.agent_flow_policy",
    "era.service.agent_generation_session",
    "era.service.mk_engine",
    "era.service.sync_work_preparation",
    "era.service.types"
  ],
  "rulesets": [
    "vibeflow.process"
  ]
});

export const finishDirect = defineNode({
  "id": "era.prepare_generation_facts.finish_direct",
  "node_type": "vibeflow.node",
  "version": "1.0.0",
  "display_name": "沿用无需历史重算的生成资料",
  "description": "本次生成可以直接继续，或重试已经被判定过期时，原样交出已读取的生成资料与判断结果。让外层选择继续生成或返回原因，而不额外改动历史。",
  "flow_kind": "process",
  "contract": {
    "requires": [
      {
        "type": "era.agent.baseline.state",
        "cardinality": "exactly_one",
        "display_name": "生成前已读取的资料及恢复要求"
      }
    ],
    "provides": [
      {
        "key": "direct_facts",
        "type": "era.agent.generation.facts",
        "display_name": "可用于判断生成阶段的聊天资料"
      }
    ],
    "params_schema": {},
    "params_defaults": {},
    "input_semantics": {
      "era.agent.baseline.state": [
        "包含当前正文、配置、会话和检查问题，标明是否需要先按保留历史重建变量起点。"
      ]
    },
    "output_semantics": {
      "direct_facts": [
        "包含本次聊天、保留正文、配置和已恢复的变量起点或失败原因，供生成阶段选择使用。"
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
        "ref": "nodes/agent/prepare_generation_facts.ts",
        "export": "finishDirect"
      }
    }
  ],
  "base_libs": [
    "era.service.readonly_preview",
    "era.service.agent_flow_policy",
    "era.service.agent_generation_session",
    "era.service.mk_engine",
    "era.service.sync_work_preparation",
    "era.service.types"
  ],
  "rulesets": [
    "vibeflow.process"
  ]
});
