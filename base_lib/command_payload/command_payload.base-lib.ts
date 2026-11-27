import { defineBaseLib } from "@vibeflow/plugin";

export const commandPayload = defineBaseLib({
  id: "era.command.payload",
  display_name: "解析变量与函数指令正文",
  description: "提取指令标签并解析其 JSON，保留字符串字面量。仅修正可识别的结构符号，失败由各调用场景处理。",
  version: "1.0.0",
  implementations: [{ language: "typescript", targets: ["node", "browser"], source: { kind: "file", ref: "base_lib/command_payload/command_payload.ts" } }],
  dependencies: [],
  rulesets: ["vibeflow.base_lib"],
});
