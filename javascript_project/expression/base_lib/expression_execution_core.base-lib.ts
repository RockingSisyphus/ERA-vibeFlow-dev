import {defineBaseLib} from "@vibeflow/plugin";

export const era_expression_execution_core = defineBaseLib({
  "id": "era.expression.execution_core",
  "display_name": "表达式执行核心计算",
  "description": "引用、函数、微积分和初始序列状态的纯计算。",
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
        "ref": "base_lib/expression_execution_core.ts"
      }
    }
  ],
  "dependencies": [
    "era.expression.types",
    "era.expression.primitives"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
