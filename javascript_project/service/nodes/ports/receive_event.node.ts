import {defineNode} from "@vibeflow/plugin";
export const receive_event = defineNode({
  "id": "era.service.port.receive_event",
  "node_type": "vibeflow.node",
  "display_name": "等待并取入下一个聊天事件",
  "description": "从页面的先进先出队列接收一条聊天变化、脚本请求或到期事件。没有事件时等待，收到后交给检查和收集流程，为统一任务规划提供输入。",
  "flow_kind": "data_store",
  "contract": {
    "requires": [],
    "provides": [
      {
        "key": "transport_event_raw",
        "type": "era.transport.event.raw",
        "display_name": "页面队列交来的原始事件"
      }
    ],
    "input_semantics": {},
    "output_semantics": {
      "transport_event_raw": [
        "收到后仍需检查格式、大小和资料引用，再进入业务收集。"
      ]
    }
  },
  "capabilities": [
    {
      "id": "vibeflow.port",
      "operations": [
        "receive"
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
      "completion": "suspend",
      "source": {
        "kind": "file",
        "ref": "nodes/ports/receive_event.ts",
        "export": "run"
      }
    }
  ]
});
