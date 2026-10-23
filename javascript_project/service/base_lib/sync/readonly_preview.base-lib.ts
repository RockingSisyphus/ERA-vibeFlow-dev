import {defineBaseLib} from "@vibeflow/plugin";
export const readonlyPreview = defineBaseLib({
  "id": "era.service.readonly_preview",
  "display_name": "只读历史位置与结果",
  "description": "准备历史起点、选择单个正文位置并归并共享操作图结果；不执行循环、作者函数或宿主写入。",
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
        "ref": "base_lib/sync/readonly_preview.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.sync_prepare",
    "era.service.mk_engine",
    "era.service.sync_types",
    "era.sync.position_source",
    "era.service.sync_contracts",
    "era.command.operation_state"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
