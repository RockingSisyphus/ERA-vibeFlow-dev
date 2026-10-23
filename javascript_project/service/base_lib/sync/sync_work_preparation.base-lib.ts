import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_sync_work_preparation = defineBaseLib({
  "id": "era.service.sync_work_preparation",
  "display_name": "同步输入准备与初始计划",
  "description": "同步输入准备与初始计划；只处理显式输入的事实，不访问宿主、不保存业务状态。",
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
        "ref": "base_lib/sync/sync_work_preparation.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.mk_engine",
    "era.service.sync_contracts",
    "era.service.types",
    "era.service.sync_types",
    "era.service.sync_prepare"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
