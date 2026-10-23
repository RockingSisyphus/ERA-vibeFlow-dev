import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_generation_session = defineBaseLib({
  "id": "era.service.agent_generation_session",
  "display_name": "ERA 三阶段故事生成会话纯逻辑",
  "description": "规范化角色卡配置、严格解析规划与变量操作、执行白名单有限数值函数、隔离故事命令并构造有界消息报告；不访问 Tavern、模型、消息或 Sidecar。",
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
        "ref": "base_lib/agent/agent_generation_session.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.agent_configuration",
    "era.service.agent_stage_text",
    "era.service.agent_report_text"
  ],
  "external_packages": [
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
