import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_working_state = defineBaseLib({
  "id": "era.service.working_state",
  "display_name": "ERA工作状态投影",
  "description": "定义内存变量、函数、日志与待保存消息，并把待写正文投影到宿主快照；本次派发明确准备的正文优先，即使文字与原文相同，也不再用旧工作记录覆盖或重复拼接。供 Service 计算及统一保存使用。",
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
        "ref": "base_lib/working_state.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.sidecar_binding",
    "era.service.sync_contracts"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
