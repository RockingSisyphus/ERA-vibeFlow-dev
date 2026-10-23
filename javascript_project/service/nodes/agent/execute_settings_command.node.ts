import {defineNode} from "@vibeflow/plugin";

export const era_agent_execute_settings_command = defineNode({
  "version": "1.0.0",
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/agent/execute_settings_command.ts","export":"run"}}],
  "capabilities": [{"id":"era.tavern.agent","operations":["read_connection_state","read_configuration_sources","capture_preset","write_configuration","upsert_connection_profile","delete_connection_profile","clear_connection_profile_key","list_connection_models","list_connection_models_draft"]}],
  "display_name": "读取或修改多阶段生成设置",
  "description": "接收生成设置命令，按要求读取或修改角色的生成配置、预设、连接方案或模型列表。通过酒馆完成实际操作，再将真正取得的结果或失败原因交回设置任务。",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.agent.settings.request","cardinality":"exactly_one","display_name":"本次生成设置操作及当前资料"}],"provides":[{"key":"settings_outcome","type":"era.agent.settings.outcome","display_name":"生成设置操作的实际结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.settings.request":["包含配置、预设、连接或模型列表的操作要求及执行所需资料，供酒馆执行对应设置请求。"]},"output_semantics":{"settings_outcome":["记录本次设置读取或修改真正返回的内容及问题，供原请求获得处理确认。"]}},
  "base_libs": ["era.service.agent_flow_policy","era.service.agent_flow_types","era.service.agent_generation_context","era.service.agent_generation_session","era.service.agent_settings_policy"],
  "tags": ["Agent 工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.execute_settings_command",
  "node_type": "vibeflow.node"
});
