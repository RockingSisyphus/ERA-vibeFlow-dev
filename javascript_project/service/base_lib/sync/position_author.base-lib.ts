import {defineBaseLib} from "@vibeflow/plugin";

export const era_sync_position_author = defineBaseLib({
  "id": "era.sync.position_author",
  "display_name": "作者函数位置步骤",
  "description": "提供正文作者函数的调用进度处理：安排启动、等待、提交应用后的回执及结束清理，记录历史同步请求的拒绝原因。",
  "version": "1.0.0",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/sync/position_author.ts"
      }
    }
  ],
  "dependencies": [
    "era.sync.position_source",
    "era.service.function_block_execution",
    "era.service.sync_contracts"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
