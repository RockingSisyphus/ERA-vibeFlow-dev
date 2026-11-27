import { defineBaseLib } from "@vibeflow/plugin";

export const variableWrite = defineBaseLib({
  id: "era.variable.write",
  display_name: "校验并写入变量字段",
  description: "沿显式路径读取父规则，检查新增、修改或删除以及整表替换的子项变化，生成通过校验的单次写入。",
  version: "1.0.0",
  implementations: [{ language: "typescript", targets: ["node", "browser"], source: { kind: "file", ref: "base_lib/variable_write/variable_write.ts" } }],
  dependencies: [],
  rulesets: ["vibeflow.base_lib"],
});
