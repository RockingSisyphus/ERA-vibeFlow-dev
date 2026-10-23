import {defineBaseLib} from "@vibeflow/plugin";

export const era_expression_primitives = defineBaseLib({
  "id": "era.expression.primitives",
  "display_name": "数学与随机原语",
  "description": "数学与随机原语的独立算法与类型，不依赖工作流端口或公共完整求值入口。",
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
        "ref": "base_lib/expression_primitives.ts"
      }
    }
  ],
  "dependencies": [
    "era.expression.types"
  ],
  "external_packages": [
    "@stdlib/math-base-special-gamma"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
