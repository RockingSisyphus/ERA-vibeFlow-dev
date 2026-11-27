import {defineNode} from "@vibeflow/plugin";

export const retainHostResources = defineNode({
  id: "era.tavern.retain_host_resources",
  node_type: "vibeflow.node",
  display_name: "保留本流程所属实例的本地资源",
  description: "将宿主传入的同一资源对象传给本图的通信步骤和子流程。循环继续沿用该对象，跨工作流消息不会携带它。",
  flow_kind: "process",
  rulesets: ["vibeflow.process"],
  contract: {
    requires: [{type:"era.workflow.host_resources",cardinality:"exactly_one",display_name:"当前实例的本地资源"}],
    provides: [{key:"retained_host_resources",type:"era.workflow.host_resources",display_name:"向本图转交的同一组资源"},
      {key:"resources_transferred",type:"era.workflow.resources_transferred",display_name:"本段资源已转交"}],
    params_schema: {},
    params_defaults: {},
    input_semantics: {"era.workflow.host_resources":["当前宿主为本流程提供的资源地址、等待与清理接口"]},
    output_semantics: {retained_host_resources:["供本图后续步骤使用的同一个资源对象"], resources_transferred:["资源已沿图内连边发出，可以展开原有业务分支"]},
  },
  run(inputs) {
    return {retained_host_resources:inputs["era.workflow.host_resources"].value, resources_transferred:/** @type {true} */ (true)};
  },
});
