import {defineBaseLib} from "@vibeflow/plugin";

export const era_command_compaction_interpreter = defineBaseLib({
  "id": "era.command_compaction.interpreter",
  "display_name": "命令层解析与原语执行",
  "description": "六类命令的解析、状态操作与函数库更新原语。",
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
        "ref": "base_lib/command_compaction_interpreter.ts"
      }
    }
  ],
  "dependencies": ["era.command.payload", "era.variable.write"],
  "external_packages": [
    "@era/vibeflow-expression"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
