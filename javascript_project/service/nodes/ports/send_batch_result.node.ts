import {defineNode} from "@vibeflow/plugin";
export const send_batch_result = defineNode({
  "id": "era.service.port.send_batch_result",
  "node_type": "vibeflow.node",
  "display_name": "把整批处理确认和通知发回页面",
  "description": "将已结算批次的事件确认、通知、问题和停止原因送回酒馆。需要停止服务时也先发出结果，使等待中的脚本和界面能够收到具体原因。",
  "flow_kind": "data_store",
  "contract": {
    "requires": [
      {
        "type": "era.batch.result",
        "cardinality": "exactly_one",
        "display_name": "应发回页面的批次确认和通知"
      }
    ],
    "provides": [],
    "input_semantics": {
      "era.batch.result": [
        "这是已经结算的事件结果，不是新的待执行任务，页面据此完成原请求等待。"
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
        "ref": "nodes/ports/send_batch_result.ts",
        "export": "run"
      }
    }
  ]
});
