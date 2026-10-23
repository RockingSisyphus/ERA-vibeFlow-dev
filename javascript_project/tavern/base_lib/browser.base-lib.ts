import {defineBaseLib} from "@vibeflow/plugin";

export const era_tavern_browser = defineBaseLib({
  "id": "era.tavern.browser",
  "display_name": "原始酒馆 API 与数据投影原语",
  "description": "发现同一个真实酒馆宿主并转换原始数据；不持有会话、任务或调度机制。",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/browser.ts"
      }
    }
  ],
  "rulesets": [
    "vibeflow.data_store"
  ]
});
