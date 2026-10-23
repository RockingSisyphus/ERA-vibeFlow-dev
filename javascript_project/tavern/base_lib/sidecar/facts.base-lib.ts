import {defineBaseLib} from "@vibeflow/plugin";

export const era_tavern_sidecar_facts = defineBaseLib({
  "id": "era.tavern.sidecar_facts",
  "display_name": "Sidecar 身份、文件名与快照投影",
  "description": "只验证输入记录、形成文件路径和快照；状态存储和发布由具体 Node 执行。",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/sidecar/facts.ts"
      }
    }
  ],
  "dependencies": [
    "era.tavern.browser"
  ],
  "rulesets": [
    "vibeflow.data_store"
  ]
});
