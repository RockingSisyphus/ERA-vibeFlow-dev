import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_report_text = defineBaseLib({
  "id": "era.service.agent_report_text",
  "display_name": "多阶段生成 阶段报告文本",
  "description": "阶段提示词、持久化报告及消息键提取。",
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
        "ref": "base_lib/agent/agent_report_text.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.agent_configuration"
  ],
  "external_packages": [
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
