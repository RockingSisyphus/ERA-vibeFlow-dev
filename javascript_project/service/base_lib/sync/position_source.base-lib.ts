import {defineBaseLib} from "@vibeflow/plugin";

export const era_sync_position_source = defineBaseLib({
  "id": "era.sync.position_source",
  "display_name": "正文位置步骤",
  "description": "提供逐段处理聊天正文的计算步骤：建立消息历史起点、识别正文内容、接回操作日志，并在消息处理完成后准备压缩候选。",
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
        "ref": "base_lib/sync/position_source.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.mk_engine",
    "era.service.message_function_calls",
    "era.snapshot.history",
    "era.service.sync_divergence",
    "era.service.command_compaction_marker",
    "era.command.operation_state",
    "era.service.sync_contracts"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
