import {definePlugin} from "@vibeflow/plugin";
import {schema0, schema1, schema2, schema3, schema4, schema5, schema6, schema7} from "./schemas-1.ts";
import {schema8, schema9, schema10, schema11, schema12, schema13, schema14, schema15} from "./schemas-2.ts";
import {schema16, schema17, schema18, schema19, schema20} from "./schemas-3.ts";

export const plugin = definePlugin({
  id: "era.expression.schemas",
  display_name: "ERA expression 数据合同",
  description: "保留现行工作流输入、输出与内部数据的 JSON schema，供新版 AOT 与正式审核使用。",
  declaration_rulesets: ["vibeflow.plugin_declaration"],
  implementation_files: ["schemas-1.ts", "schemas-2.ts", "schemas-3.ts"],
  resources: [
    schema0,
    schema1,
    schema2,
    schema3,
    schema4,
    schema5,
    schema6,
    schema7,
    schema8,
    schema9,
    schema10,
    schema11,
    schema12,
    schema13,
    schema14,
    schema15,
    schema16,
    schema17,
    schema18,
    schema19,
    schema20
  ],
});
