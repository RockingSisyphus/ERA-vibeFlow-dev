import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_generation_context = defineBaseLib({
  "id": "era.service.agent_generation_context",
  "display_name": "多阶段生成 会话上下文与 Capability 适配",
  "description": "从阶段上下文导出稳定请求事实，并由传入的 Agent Capability 执行原会话写入。",
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
        "ref": "base_lib/agent/agent_generation_context.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.agent_stage_layout",
    "era.service.agent_session_binding",
    "era.service.agent_configuration",
    "era.service.agent_report_text",
    "era.service.agent_flow_types"
  ],
  "external_packages": [
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
