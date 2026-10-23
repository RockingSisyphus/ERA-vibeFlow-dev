import {defineBaseLib} from "@vibeflow/plugin";

export const era_macro_technical_blocks = defineBaseLib({
  "id": "era.macro.technical_blocks",
  "display_name": "技术块纯文本结构",
  "description": "技术块纯文本结构的真实共享源码，供原宏节点及App同源出口消费。",
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
        "ref": "base_lib/syntax/technical_blocks.ts"
      }
    }
  ],
  "dependencies": [],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
