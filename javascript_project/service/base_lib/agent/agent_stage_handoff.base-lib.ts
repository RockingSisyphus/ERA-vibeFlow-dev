import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_stage_handoff = defineBaseLib({
  "id": "era.service.agent_stage_handoff",
  "display_name": "多阶段生成 阶段交接策略",
  "description": "构造成功阶段完成身份与业务恢复意图，不等待页面回调。",
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
        "ref": "base_lib/agent/agent_stage_handoff.ts"
      }
    }
  ],
  "dependencies": [],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
