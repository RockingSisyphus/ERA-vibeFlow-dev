import {defineNode} from "@vibeflow/plugin";

export const era_agent_prepare_settings_request = defineNode({
  "version": "1.0.0",
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/agent/prepare_settings_request.ts","export":"run"}}],
  "capabilities": [{"id":"era.tavern.agent","operations":["read_context"]}],
  "display_name": "整理本次生成设置操作所需资料",
  "description": "接收用户的生成设置请求，读取这项操作需要的当前配置、预设或连接资料。将明确的操作及原请求一起交给执行步骤，使结果能够对应回发起者。",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"}],"provides":[{"key":"settings_request","type":"era.agent.settings.request","display_name":"本次生成设置操作及当前资料"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"]},"output_semantics":{"settings_request":["包含配置、预设、连接或模型列表的操作要求及执行所需资料，供酒馆执行对应设置请求。"]}},
  "base_libs": ["era.service.agent_flow_types","era.service.types"],
  "tags": ["Agent 工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.prepare_settings_request",
  "node_type": "vibeflow.node"
});
