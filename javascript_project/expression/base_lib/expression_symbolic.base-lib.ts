import {defineBaseLib} from "@vibeflow/plugin";

export const era_expression_symbolic = defineBaseLib({
  "id": "era.expression.symbolic",
  "display_name": "符号压缩",
  "description": "符号压缩的独立算法与类型，不依赖工作流端口或公共完整求值入口。",
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
        "ref": "base_lib/expression_symbolic.ts"
      }
    }
  ],
  "dependencies": [
    "era.expression.types",
    "era.expression.syntax",
    "era.expression.functions",
    "era.expression.primitives"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
