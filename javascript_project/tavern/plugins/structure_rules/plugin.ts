import {definePlugin,defineRuleset} from "@vibeflow/plugin";
const structure=defineRuleset({id:"era.tavern.workflow_structure",display_name:"酒馆完整工作流与五层职责组合",description:"保留全部默认规则；共享业务体与通信入口分离多一层，将深度预算由4调整为5，递归、数据流及资源检查继续执行。",graph_scope:"effective_subtree",calls:[{id:"base",ruleset_id:"vibeflow.workflow"}],relations:[{source:"$self",target:"base/nodeset_types",kind:"overrides",params:{nodeset_max_depth:5}}]});
export const plugin=definePlugin({id:"era.tavern.structure_rules",declaration_rulesets:["vibeflow.plugin_declaration"],resources:[structure]});
