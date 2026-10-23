import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_settings_policy = defineBaseLib({
  "id": "era.service.agent_settings_policy",
  "display_name": "多阶段生成 设置草稿策略",
  "description": "Agent 设置草稿策略；纯计算，不执行 Capability，不接收批次状态。",
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
        "ref": "base_lib/agent/agent_settings_policy.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.agent_configuration"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
