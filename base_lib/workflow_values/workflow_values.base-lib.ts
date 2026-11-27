import {defineBaseLib} from "@vibeflow/plugin";
export const workflowValues = defineBaseLib({
  id: "era.workflow.values",
  display_name: "工作流通信中的业务值转换",
  description: "把变量和计算结果转换为官方通信可承载的纯数据消息，再恢复原值；保留大数、负零、缺失值和数组空位，不持有页面资源、不调度流程。",
  version: "0.1.0",
  implementation_files:["codec.d.mts"],implementations: [{language:"javascript",targets:["node","browser"],source:{kind:"file",ref:"base_lib/workflow_values/codec.mjs"}}],
  dependencies: [], external_packages: [], rulesets: ["vibeflow.base_lib"]
});
