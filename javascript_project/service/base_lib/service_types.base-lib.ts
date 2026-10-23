import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_types = defineBaseLib({
  "id": "era.service.types",
  "display_name": "ERA 服务协议类型",
  "description": "定义 Service 工作流内部的严格 JSON DTO 类型，不包含计算、宿主访问或可变状态。",
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
        "ref": "base_lib/service_types.ts"
      }
    }
  ],
  "dependencies": [],
  "external_packages": [
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
