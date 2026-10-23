import {defineBaseLib} from "@vibeflow/plugin";

export const era_tavern_receipts = defineBaseLib({
  "id": "era.tavern.receipts",
  "display_name": "单个回执资源结算",
  "description": "原子结算当前明确指定的回执、释放其引用并触发回调；选择与遍历仍由 Node 和原生 Loop 执行。",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/receipts.ts"
      }
    }
  ],
  "dependencies": [
    "era.tavern.frames"
  ],
  "rulesets": [
    "vibeflow.data_store"
  ]
});
