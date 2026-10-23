import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_task_continuation = defineBaseLib({
  "id": "era.service.task_continuation",
  "display_name": "当前任务接续",
  "description": "提供原任务资料的传递和结果适配，使准备、执行及回执能够对应同一任务；批次结算时推进任务位置。",
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
        "ref": "base_lib/task_continuation.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.types"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
