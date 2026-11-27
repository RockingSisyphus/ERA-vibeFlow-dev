import {defineBaseLib} from "@vibeflow/plugin";

export const era_data_view = defineBaseLib({
  "id": "era.data_view",
  "display_name": "ERA 数据视图转换",
  "description": "Macro、Service与展示快照共用的数据反转义、元字段过滤和变量路径拆分；不读写宿主或业务状态。",
  "version": "0.1.1",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/data_view/data_view.ts"
      }
    }
  ],
  "dependencies": [],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
