import {defineBaseLib} from "@vibeflow/plugin";

export const era_expression_syntax = defineBaseLib({
  "id": "era.expression.syntax",
  "display_name": "语法与输入解析",
  "description": "语法与输入解析的独立算法与类型，不依赖工作流端口或公共完整求值入口。",
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
        "ref": "base_lib/expression_syntax.ts"
      }
    }
  ],
  "dependencies": [
    "era.expression.primitives",
    "era.expression.types"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
