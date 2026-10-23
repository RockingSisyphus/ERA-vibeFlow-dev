import {defineBaseLib} from "@vibeflow/plugin";

export const era_snapshot_public_state = defineBaseLib({
  "id": "era.snapshot.public_state",
  "display_name": "ERA 作者公开状态",
  "description": "ERA 作者公开状态的纯计算，仅接收已提交快照值。",
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
        "ref": "base_lib/snapshot/public_state.ts"
      }
    }
  ],
  "dependencies": [
    "era.data_view"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
