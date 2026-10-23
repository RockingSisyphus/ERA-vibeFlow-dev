import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_sidecar_resolution_projection = defineBaseLib({
  "id": "era.service.sidecar_resolution_projection",
  "display_name": "独立状态文件 解析投影",
  "description": "同步上下文的纯变量、状态和消息依据投影。",
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
        "ref": "base_lib/sidecar_resolution_projection.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.sidecar_binding"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
