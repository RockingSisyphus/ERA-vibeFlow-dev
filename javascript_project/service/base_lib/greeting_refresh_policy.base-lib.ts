import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_greeting_refresh_policy = defineBaseLib({
  "id": "era.service.greeting_refresh_policy",
  "display_name": "主开场白刷新决策",
  "description": "根据写卡后的当前聊天事实决定保留或刷新，不读取宿主。",
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
        "ref": "base_lib/greeting_refresh_policy.ts"
      }
    }
  ],
  "dependencies": [],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
