import {definePlugin} from "@vibeflow/plugin";
export const plugin=definePlugin({id:"era.tavern.protocol_resources",display_name:"同页工作流资源边界",description:"同一ERA实例的资源编号、可取消宿主轮次等待及实际清理；通信由官方Coordinator执行，领域操作顺序仍由Service图决定。",declaration_rulesets:["vibeflow.plugin_declaration"],resources:[],implementation_files:["runtime.mjs"]});
