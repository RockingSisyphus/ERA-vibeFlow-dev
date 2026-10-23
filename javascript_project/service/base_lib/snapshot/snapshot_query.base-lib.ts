import {defineBaseLib} from "@vibeflow/plugin";

export const era_snapshot_query = defineBaseLib({
  "id": "era.snapshot.query",
  "display_name": "ERA 时间旅行与快照查询纯函数库",
  "description": "纯函数实现编辑日志解析、状态正反向时间旅行、ERA 数据反转义、递归移除美元前缀字段及五类公开只读查询；只接收规范化变量和消息上下文，不访问或写入宿主。",
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
        "ref": "base_lib/snapshot/snapshot_query.ts"
      }
    }
  ],
  "dependencies": [
    "era.data_view",
    "era.snapshot.history"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
