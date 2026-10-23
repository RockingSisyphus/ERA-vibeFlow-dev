import {defineBaseLib} from "@vibeflow/plugin";

export const era_tavern_frames = defineBaseLib({
  "id": "era.tavern.frames",
  "display_name": "辅助流程内部输入与错误合同",
  "description": "解包调用、严格汇合单结果及规范化错误；不选择或调度业务路径。",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/frames.ts"
      }
    }
  ],
  "rulesets": [
    "vibeflow.data_store"
  ]
});
