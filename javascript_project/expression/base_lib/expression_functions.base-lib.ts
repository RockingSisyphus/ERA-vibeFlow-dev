import {defineBaseLib} from "@vibeflow/plugin";

export const era_expression_functions = defineBaseLib({
  "id": "era.expression.functions",
  "display_name": "函数库编译",
  "description": "函数库编译的独立算法与类型，不依赖工作流端口或公共完整求值入口。",
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
        "ref": "base_lib/expression_functions.ts"
      }
    }
  ],
  "dependencies": [
    "era.expression.types",
    "era.expression.primitives",
    "era.expression.syntax"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
