import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_generation_continue = defineBaseLib({
  "id": "era.service.agent_generation_continue",
  "display_name": "多阶段生成 阶段继续",
  "description": "在原继续事件位置验证阶段身份、恢复会话并提交下一阶段；保留等待期间额外提交的事务，已在完成阶段中的作者记录不再复制，同文多次提交仍保留各次记录。",
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
        "ref": "base_lib/agent/agent_generation_continue.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.agent_stage_layout",
    "era.service.agent_generation_context",
    "era.service.agent_generation_settlement",
    "era.service.agent_report_text",
    "era.service.agent_configuration",
    "era.service.agent_flow_types"
  ],
  "external_packages": [
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
