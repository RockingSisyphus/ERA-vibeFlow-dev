import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_stage_text = defineBaseLib({
  "id": "era.service.agent_stage_text",
  "display_name": "阶段结构化报告与执行文本分离",
  "description": "规划JSON与顶层操作分离；结算直接检查共用块解析覆盖的标签原文，保留有效前缀及具体格式错误位置，不转换JSON操作。",
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
        "ref": "base_lib/agent/agent_stage_text.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.message_function_calls"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
