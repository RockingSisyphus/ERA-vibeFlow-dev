import {definePlugin, defineRuleset} from "@vibeflow/plugin";
const workflowStructure = defineRuleset({
  id: "era.service.workflow_structure",
  display_name: "Service完整工作流检查与七层职责组合",
  description: "继承全部默认工作流检查，只把子图深度上限设为7：服务循环、任务、业务阶段、预演或压缩、位置或候选循环、共享操作循环、操作步骤。递归、数据、控制流与资源归属检查仍执行。",
  graph_scope: "effective_subtree",
  calls: [{id: "base", ruleset_id: "vibeflow.workflow"}],
  relations: [{source: "$self", target: "base/nodeset_types", kind: "overrides", params: {nodeset_max_depth: 7}}]
});
export const plugin = definePlugin({id:"era.service.structure_rules", display_name:"Service结构审查", description:"保留全部默认规则，按真实职责组合检查七层子图深度。", declaration_rulesets:["vibeflow.plugin_declaration"], resources:[workflowStructure]});
