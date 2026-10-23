import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_service_protocol_execution = defineBaseLib({
  "id": "era.service.service_protocol_execution",
  "display_name": "service-protocol-execution",
  "description": "ERA Service protocol source module.",
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
        "ref": "base_lib/service_protocol_execution.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.types"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
