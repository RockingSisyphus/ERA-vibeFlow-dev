import {defineBaseLib} from "@vibeflow/plugin";

export const era_tavern_resources = defineBaseLib({
  "id": "era.tavern.resources",
  "display_name": "Promise、时钟和取消资源原语",
  "description": "创建局部等待句柄、链接取消信号和释放监听；行为顺序仍由 Node 和 Config 决定。",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/resources.ts"
      }
    }
  ],
  "rulesets": [
    "vibeflow.data_store"
  ]
});
