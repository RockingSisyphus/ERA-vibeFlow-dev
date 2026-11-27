import {defineBaseLib} from "@vibeflow/plugin";

export const era_command_operation_expressions = defineBaseLib({
  "id": "era.command.operation_expressions",
  "display_name": "公式请求与接续",
  "description": "为变量公式、整库检查和生成阶段函数构造求值资料，接回实际结果、诊断及随机进度。",
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
        "ref": "base_lib/domain/commands/operation_expressions.ts"
      }
    }
  ],
  "dependencies": [
    "era.command.operation_traversal",
    "era.command.operation_state",
    "era.crud.mutations",
    "era.crud.parser",
    "era.service.agent_flow_types"
  ],
  "external_packages": [
    "@era/vibeflow-expression"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
