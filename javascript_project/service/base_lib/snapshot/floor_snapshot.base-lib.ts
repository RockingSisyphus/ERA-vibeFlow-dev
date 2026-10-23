import {defineBaseLib} from "@vibeflow/plugin";

export const era_snapshot_floor_projection = defineBaseLib({
  "id": "era.snapshot.floor_projection",
  "display_name": "ERA 按楼快照、作者状态与消息键",
  "description": "按楼重建、作者状态和消息键的真实同步出口，由同源包供 App 消费。",
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
        "ref": "base_lib/snapshot/floor_snapshot.ts"
      }
    }
  ],
  "dependencies": [
    "era.data_view",
    "era.snapshot.public_state"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
