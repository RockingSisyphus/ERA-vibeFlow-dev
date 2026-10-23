import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_sync_prepare = defineBaseLib({
  "id": "era.service.sync_prepare",
  "display_name": "sync-prepare",
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
        "ref": "base_lib/domain/sync/sync_prepare.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.message_function_calls",
    "era.service.mk_engine",
    "era.snapshot.history",
    "era.service.sync_types",
    "era.service.sync_divergence",
    "era.service.sync_divergence_detection"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
