import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_flow_policy = defineBaseLib({
  "id": "era.service.agent_flow_policy",
  "display_name": "多阶段生成 阶段决策与候选映射",
  "description": "Agent 阶段决策与候选映射；纯计算，不执行 Capability，不接收批次状态。",
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
        "ref": "base_lib/agent/agent_flow_policy.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.agent_flow_types",
    "era.service.agent_configuration",
    "era.service.mk_engine",
    "era.service.types"
  ],
  "external_packages": [
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
