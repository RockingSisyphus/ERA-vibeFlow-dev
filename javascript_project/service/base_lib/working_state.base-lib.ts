import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_working_state = defineBaseLib({
  "id": "era.service.working_state",
  "display_name": "ERA工作状态投影",
  "description": "定义当前内存变量、函数、日志和待保存消息的结构，供 Service 计算及保存计划使用。",
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
        "ref": "base_lib/working_state.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.sidecar_binding",
    "era.service.sync_contracts"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
