import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_command_compaction = defineBaseLib({
  "id": "era.service.command_compaction",
  "display_name": "Service 命令压缩编排",
  "description": "把纯压缩器输出经既有 CRUD 引擎复放确认后回填同步计划；不包含标签解析或代数重写。",
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
        "ref": "base_lib/sync/command_compaction.ts"
      }
    }
  ],
  "dependencies": [
    "era.workflow.progress",
    "era.service.command_compaction_marker",
    "era.service.mk_engine",
    "era.service.sync_contracts",
    "era.service.sync_types",
    "era.command.operation_state"
  ],
  "external_packages": [
    "@era/vibeflow-command-compaction"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
