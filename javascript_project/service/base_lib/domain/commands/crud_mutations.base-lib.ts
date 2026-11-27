import {defineBaseLib} from "@vibeflow/plugin";

export const era_crud_mutations = defineBaseLib({
  "id": "era.crud.mutations",
  "display_name": "crud-mutations",
  "description": "ERA CRUD source module.",
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
        "ref": "base_lib/domain/commands/crud_mutations.ts"
      }
    }
  ],
  "dependencies": [
    "era.data_view",
    "era.crud.parser"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
