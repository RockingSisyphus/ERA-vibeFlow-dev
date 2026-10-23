import {defineBaseLib} from "@vibeflow/plugin";

export const era_command_operation_state = defineBaseLib({
  "id": "era.command.operation_state",
  "display_name": "有序操作状态",
  "description": "有序操作状态；明确区分当前状态、消息起点快照、函数候选和随机位置，只在块终结后交回外层。",
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
        "ref": "base_lib/domain/commands/operation_state.ts"
      }
    }
  ],
  "dependencies": [
    "era.crud.parser"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
