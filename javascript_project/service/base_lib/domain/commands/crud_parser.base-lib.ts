import {defineBaseLib} from "@vibeflow/plugin";

export const era_crud_parser = defineBaseLib({
  "id": "era.crud.parser",
  "display_name": "crud-parser",
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
        "ref": "base_lib/domain/commands/crud_parser.ts"
      }
    }
  ],
  "dependencies": ["era.command.payload"],
  "external_packages": [
    "opencc-js",
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
