import {defineBaseLib} from "@vibeflow/plugin";

export const era_macro_lodash_get = defineBaseLib({
  "id": "era.macro.lodash_get",
  "display_name": "Lodash 路径兼容读取",
  "description": "以无状态纯函数实现 Lodash get 的 JSON 字符串路径词法和读取语义。",
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
        "ref": "base_lib/lodash_get_compatible.ts"
      }
    }
  ],
  "dependencies": [],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
