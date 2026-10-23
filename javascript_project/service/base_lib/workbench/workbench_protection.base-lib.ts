import {defineBaseLib} from "@vibeflow/plugin";

export const era_workbench_protection = defineBaseLib({
  "id": "era.workbench.protection",
  "display_name": "工作台 protection 纯规则",
  "description": "按真实变更计算保护，组合解锁与恢复。",
  "version": "1.0.0",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/workbench/workbench_protection.ts"
      }
    }
  ],
  "dependencies": [
    "era.workbench.operations",
    "era.workbench.draft"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
