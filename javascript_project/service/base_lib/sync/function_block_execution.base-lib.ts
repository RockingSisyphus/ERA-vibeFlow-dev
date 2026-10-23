import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_function_block_execution = defineBaseLib({
  "id": "era.service.function_block_execution",
  "display_name": "函数位置与普通API事务规划",
  "description": "检查作者函数发起的提交及其允许执行范围，将命令插入当前调用位置，供消息流程继续执行。",
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
        "ref": "base_lib/sync/function_block_execution.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.facade_api_engine",
    "era.service.message_function_calls",
    "era.service.sync_contracts"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
