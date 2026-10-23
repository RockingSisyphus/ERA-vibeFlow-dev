import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_command_compaction_marker = defineBaseLib({
  "id": "era.service.command_compaction_marker",
  "display_name": "封存命令层压缩标记",
  "description": "为已检查的封存消息提供可失效、非完整性门禁的内容指纹调度提示。",
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
        "ref": "base_lib/domain/commands/command_compaction_marker.ts"
      }
    }
  ],
  "dependencies": [],
  "external_packages": [
    "@era/vibeflow-contracts"
  ],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
