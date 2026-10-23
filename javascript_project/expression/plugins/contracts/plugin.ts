import {definePlugin} from "@vibeflow/plugin";
import {contract_0_0, contract_0_1, contract_0_2, contract_0_3, contract_0_4, contract_0_5, contract_0_6, contract_0_7, contract_0_8, contract_0_9, contract_0_10, contract_0_11, contract_0_12, contract_0_13, contract_0_14, contract_0_15, contract_0_16, contract_0_17, contract_0_18, contract_0_19} from "./contracts-1.ts";
import {contract_1_0} from "./contracts-2.ts";

export const plugin = definePlugin({
  id: "era.expression.contracts",
  display_name: "ERA expression数据与权限合同",
  description: "保留本root的现行数据结构与Capability合同；业务Node和独立BaseLib分别归属标准目录。",
  declaration_rulesets: ["vibeflow.plugin_declaration"],
  implementation_files: ["contracts-1.ts","contracts-2.ts"],
  resources: [contract_0_0, contract_0_1, contract_0_2, contract_0_3, contract_0_4, contract_0_5, contract_0_6, contract_0_7, contract_0_8, contract_0_9, contract_0_10, contract_0_11, contract_0_12, contract_0_13, contract_0_14, contract_0_15, contract_0_16, contract_0_17, contract_0_18, contract_0_19, contract_1_0],
});
