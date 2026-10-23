import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_sidecar_binding = defineBaseLib({
  "id": "era.service.sidecar_binding",
  "display_name": "ERA 独立状态文件 绑定规则",
  "description": "Sidecar 身份、记录校验、冲突选择和快照记录的纯规则；不访问 Tavern 或 files。",
  "version": "1.0.0",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/sidecar_binding.ts"
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
