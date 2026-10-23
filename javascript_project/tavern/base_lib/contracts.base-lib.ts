import {defineBaseLib} from "@vibeflow/plugin";

export const era_tavern_contracts = defineBaseLib({
  "id": "era.tavern.contracts",
  "display_name": "ERA 既有传输合同",
  "description": "复用官方 DTO 校验和默认限额，不复制合同。",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/contracts.ts"
      }
    }
  ],
  "external_packages": [
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
