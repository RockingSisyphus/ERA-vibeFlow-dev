import {defineBaseLib} from "@vibeflow/plugin";

export const era_macro_runtime = defineBaseLib({
  "id": "era.macro.runtime",
  "display_name": "ERA 宏纯函数库",
  "description": "原宏节点共用的文本准备、快照选择、普通/延迟宏扫描、路径解析与结果格式化。",
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
        "ref": "base_lib/macro_runtime.ts"
      }
    }
  ],
  "dependencies": [
    "era.data_view",
    "era.macro.lodash_get",
    "era.macro.macro_syntax",
    "era.macro.technical_blocks"
  ],
  "external_packages": [
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
