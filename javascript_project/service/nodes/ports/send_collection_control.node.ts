import {defineNode} from "@vibeflow/plugin";
export const send_collection_control = defineNode({
  "id": "era.service.port.send_collection_control",
  "node_type": "vibeflow.node",
  "display_name": "把事件收集的计时安排交给页面",
  "description": "接收本轮收集阶段决定的定时要求，通知页面启动、取消或保留相应计时。到期事件会重新进入服务，帮助等待中的事件按期限组成批次。",
  "flow_kind": "data_store",
  "contract": {
    "requires": [
      {
        "type": "era.collection.control",
        "cardinality": "exactly_one",
        "display_name": "本轮需要页面执行的计时安排"
      }
    ],
    "provides": [],
    "input_semantics": {
      "era.collection.control": [
        "明确要求启动、取消或保留哪些收集期限，供页面计时流程执行。"
      ]
    },
    "output_semantics": {}
  },
  "capabilities": [
    {
      "id": "vibeflow.port",
      "operations": [
        "send"
      ]
    }
  ],
  "rulesets": [
    "vibeflow.data_store"
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
        "ref": "nodes/ports/send_collection_control.ts",
        "export": "run"
      }
    }
  ]
});
