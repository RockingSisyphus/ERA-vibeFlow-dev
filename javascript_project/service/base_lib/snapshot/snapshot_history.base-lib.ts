import {defineBaseLib} from "@vibeflow/plugin";

export const era_snapshot_history = defineBaseLib({
  "id": "era.snapshot.history",
  "display_name": "ERA 快照历史计算",
  "description": "解析编辑日志、按 MK 正向和逆向重放，并提供独立的历史值查询。",
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
        "ref": "base_lib/snapshot/snapshot_history.ts"
      }
    }
  ],
  "dependencies": ["era.data_view"],
  "external_packages": [
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
