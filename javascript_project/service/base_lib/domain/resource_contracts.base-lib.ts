import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_resource_contracts = defineBaseLib({
  "id": "era.service.resource_contracts",
  "display_name": "resource-contracts",
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
        "ref": "base_lib/domain/resource_contracts.ts"
      }
    }
  ],
  "dependencies": [],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
