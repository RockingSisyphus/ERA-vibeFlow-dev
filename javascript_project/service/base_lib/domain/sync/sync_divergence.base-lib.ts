import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_sync_divergence = defineBaseLib({
  "id": "era.service.sync_divergence",
  "display_name": "sync-divergence",
  "description": "ERA sync engine stage source.",
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
        "ref": "base_lib/domain/sync/sync_divergence.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.mk_engine",
    "era.snapshot.history",
    "era.service.sync_types"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
