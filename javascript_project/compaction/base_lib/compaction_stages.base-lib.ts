import {defineBaseLib} from "@vibeflow/plugin";

export const era_command_compaction_stages = defineBaseLib({
  "id": "era.command_compaction.stages",
  "display_name": "顺序分段压缩阶段",
  "description": "拥有作用域分段、段状态继承与确认结果构造；流程顺序由 Config 控制。",
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
        "ref": "base_lib/compaction_stages.ts"
      }
    }
  ],
  "dependencies": [
    "era.command_compaction.engine"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
