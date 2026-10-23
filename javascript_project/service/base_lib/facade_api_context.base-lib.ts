import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_facade_api_context = defineBaseLib({
  "id": "era.service.facade_api_context",
  "display_name": "ERA 公共接口 请求窗口",
  "description": "即时 Scope Facade 的请求校验、窗口检查与操作归一化。",
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
        "ref": "base_lib/facade_api_context.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.types"
  ],
  "external_packages": [
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
