import {defineBaseLib} from "@vibeflow/plugin";

export const era_command_operation_traversal = defineBaseLib({
  "id": "era.command.operation_traversal",
  "display_name": "有序路径操作",
  "description": "提供变量字段的有序处理：检查新增模板、修改和删除保护，安排子字段顺序，并记录变量变化。",
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
        "ref": "base_lib/domain/commands/operation_traversal.ts"
      }
    }
  ],
  "dependencies": [
    "era.command.operation_state",
    "era.crud.mutations",
    "era.snapshot.history",
    "era.crud.parser"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
