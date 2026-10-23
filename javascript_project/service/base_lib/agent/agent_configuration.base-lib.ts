import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_configuration = defineBaseLib({
  "id": "era.service.agent_configuration",
  "display_name": "ERA 多阶段生成 配置合同与规范化",
  "description": "独立规范化 Agent 配置与预设快照，不执行生成阶段。",
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
        "ref": "base_lib/agent/agent_configuration.ts"
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
