import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_event_catalog = defineBaseLib({
  "id": "era.service.event_catalog",
  "display_name": "ERA 事件目录",
  "description": "注册事件定义、分组和组合规则。",
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
        "ref": "base_lib/domain/event_catalog.ts"
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
