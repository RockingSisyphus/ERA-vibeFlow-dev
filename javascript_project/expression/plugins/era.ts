import {definePlugin} from "@vibeflow/plugin";
import {resource0, resource1, resource2, resource3, resource4, resource5, resource6, resource7, resource8, resource9, resource10, resource11} from "./era-node-1.ts";
import {resource12, resource13, resource14, resource15, resource16, resource17, resource18} from "./era-node-2.ts";
import {resource19, resource20, resource21, resource22, resource23, resource24, resource25, resource26} from "./era-base_lib-1.ts";

export const plugin = definePlugin({
  id: "era.expression.resources",
  display_name: "ERA 现有业务资源",
  description: "以新版 SDK 登记现有节点、库和宿主资源，保留原数据合同、实现入口及业务算法。",
  declaration_rulesets: ["vibeflow.plugin_declaration"],
  implementation_files: ["era-node-1.ts", "era-node-2.ts", "era-base_lib-1.ts"],
  resources: [
    resource0,
    resource1,
    resource2,
    resource3,
    resource4,
    resource5,
    resource6,
    resource7,
    resource8,
    resource9,
    resource10,
    resource11,
    resource12,
    resource13,
    resource14,
    resource15,
    resource16,
    resource17,
    resource18,
    resource19,
    resource20,
    resource21,
    resource22,
    resource23,
    resource24,
    resource25,
    resource26,
  ],
});
