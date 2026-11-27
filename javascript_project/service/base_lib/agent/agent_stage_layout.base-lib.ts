import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_stage_layout = defineBaseLib({
  "id": "era.service.agent_stage_layout",
  "display_name": "多阶段生成 阶段消息分段与落稿",
  "description": "同一条AI楼层的阶段消息只在这里拼装、切分和核对：分段之间忽略空行与首尾空白，分段内部逐字保留；落稿正文统一去数据块与尾部空白后追加消息标识块。",
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
        "ref": "base_lib/agent/agent_stage_layout.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.mk_engine"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
