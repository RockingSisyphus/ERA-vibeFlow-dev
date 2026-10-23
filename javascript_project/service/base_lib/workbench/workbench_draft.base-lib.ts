import {defineBaseLib} from "@vibeflow/plugin";

export const era_workbench_draft = defineBaseLib({
  "id": "era.workbench.draft",
  "display_name": "工作台 draft 纯规则",
  "description": "变量与函数草稿差异，保留实际增删改及次序。",
  "version": "1.0.0",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/workbench/workbench_draft.ts"
      }
    }
  ],
  "dependencies": [
    "era.workbench.operations"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
