import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_resource_setup = defineBaseLib({
  "id": "era.service.resource_setup",
  "display_name": "resource-setup",
  "description": "ERA resource planning contract and setup source.",
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
        "ref": "base_lib/domain/resource_setup.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.resource_contracts"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
