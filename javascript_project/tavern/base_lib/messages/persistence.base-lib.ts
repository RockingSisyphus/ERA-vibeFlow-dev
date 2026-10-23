import {defineBaseLib} from "@vibeflow/plugin";

export const era_tavern_message_facts = defineBaseLib({
  "id": "era.tavern.message_facts",
  "display_name": "消息投影和固定保存依据",
  "description": "保留原消息投影、陈旧目标比较和保存文件字段核对；不创建任务、不执行保存或调度。",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/messages/persistence.ts"
      }
    }
  ],
  "implementation_files": [
    "projection.ts",
    "target.ts"
  ],
  "dependencies": [
    "era.tavern.frames",
    "era.tavern.browser"
  ],
  "rulesets": [
    "vibeflow.data_store"
  ]
});
