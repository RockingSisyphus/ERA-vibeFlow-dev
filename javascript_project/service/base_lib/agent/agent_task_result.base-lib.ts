import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_task_result = defineBaseLib({
  "id": "era.service.agent_task_result",
  "display_name": "多阶段生成 来源结果结算",
  "description": "Agent 来源结果结算；纯计算，不执行 Capability，不接收批次状态。",
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
        "ref": "base_lib/agent/agent_task_result.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.agent_flow_types",
    "era.service.types"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
