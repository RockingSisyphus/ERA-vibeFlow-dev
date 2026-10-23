import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_flow_types = defineBaseLib({
  "id": "era.service.agent_flow_types",
  "display_name": "多阶段生成 阶段与设置契约",
  "description": "Agent 阶段与设置契约；纯计算，不执行 Capability，不接收批次状态。",
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
        "ref": "base_lib/agent/agent_flow_types.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.agent_configuration",
    "era.service.types",
    "era.service.agent_stage_handoff"
  ],
  "external_packages": [
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
