import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_sync_commit_policy = defineBaseLib({
  "id": "era.service.sync_commit_policy",
  "display_name": "同步提交与读回策略",
  "description": "构造和检查提交候选、更新来源依据、判断读回结果；非提交候选复用结果模块检查可结算性。",
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
        "ref": "base_lib/sync/sync_commit_policy.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.mk_engine",
    "era.service.sync_contracts",
    "era.service.sync_types",
    "era.service.sync_result_policy",
    "era.service.types"
  ],
  "external_packages": [
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
