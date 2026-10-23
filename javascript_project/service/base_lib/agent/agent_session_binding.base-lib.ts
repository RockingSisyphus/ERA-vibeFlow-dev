import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_session_binding = defineBaseLib({
  "id": "era.service.agent_session_binding",
  "display_name": "多阶段生成 会话关联计划",
  "description": "原生来源和正文观察关联字段的纯计划，由原 Agent 执行节点在写入时消费。",
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
        "ref": "base_lib/agent/agent_session_binding.ts"
      }
    }
  ],
  "dependencies": [],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
