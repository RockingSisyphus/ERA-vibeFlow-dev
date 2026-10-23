import {defineBaseLib} from "@vibeflow/plugin";

export const era_tavern_agent_facts = defineBaseLib({
  "id": "era.tavern.agent_facts",
  "display_name": "Agent 配置、预设与脱敏连接事实",
  "description": "只验证输入和投影当前资料；设置读写、密钥使用和 HTTP 请求由具体 Node 执行。",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/agent/facts.ts"
      }
    }
  ],
  "implementation_files": [
    "profiles.ts"
  ],
  "dependencies": [
    "era.tavern.browser"
  ],
  "rulesets": [
    "vibeflow.data_store"
  ]
});
