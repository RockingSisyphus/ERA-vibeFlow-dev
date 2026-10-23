import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_sync_types = defineBaseLib({
  "id": "era.service.sync_types",
  "display_name": "ERA 同步引擎合同",
  "description": "同步计划、动作、连续 MK 状态及块执行游标类型。",
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
        "ref": "base_lib/domain/sync/sync_types.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.mk_engine"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
