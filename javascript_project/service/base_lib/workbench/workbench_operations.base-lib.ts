import {defineBaseLib} from "@vibeflow/plugin";

export const era_workbench_operations = defineBaseLib({
  "id": "era.workbench.operations",
  "display_name": "工作台 operations 纯规则",
  "description": "操作 DTO、JSON 路径与显式有序操作校验。",
  "version": "1.0.0",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/workbench/workbench_operations.ts"
      }
    }
  ],
  "dependencies": [],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
