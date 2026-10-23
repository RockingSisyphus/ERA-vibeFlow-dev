import {defineBaseLib} from "@vibeflow/plugin";

export const era_macro_macro_syntax = defineBaseLib({
  "id": "era.macro.macro_syntax",
  "display_name": "宏语法与延迟标记",
  "description": "宏语法与延迟标记的真实共享源码，供原宏节点及App同源出口消费。",
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
        "ref": "base_lib/syntax/macro_syntax.ts"
      }
    }
  ],
  "dependencies": [],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
