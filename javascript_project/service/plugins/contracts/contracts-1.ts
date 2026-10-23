import {defineCapability, defineDataSchema} from "@vibeflow/plugin";

export const contract_0_0 = defineCapability({
  "id": "era.tavern.agent",
  "targets": ["browser"],
  "display_name": "ERA 多阶段生成宿主 I/O",
  "description": "执行服务指定的角色设置、页面会话、模型请求和一次性内容注入，将接口实际结果交回生成流程。",
  "operations": {"await_native_completion":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"suspend"},"read_context":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"suspend"},"write_configuration":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"suspend"},"capture_preset":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"immediate"},"read_configuration_sources":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"immediate"},"read_connection_state":{"input_type":"era.agent.host.request","output_type":"era.agent.connection.state","completion":"immediate"},"upsert_connection_profile":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"suspend"},"delete_connection_profile":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"suspend"},"clear_connection_profile_key":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"suspend"},"list_connection_models":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"suspend"},"list_connection_models_draft":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"suspend"},"generate":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"suspend"},"generate_story":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"suspend"},"inject_once":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"immediate"},"write_session":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"immediate"},"clear_session":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"immediate"},"create_error_message":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"suspend"},"stop_native_generation":{"input_type":"era.agent.host.request","output_type":"era.agent.host.result","completion":"immediate"},"read_session_binding":{"input_type":"era.agent.host.request","output_type":"era.agent.session.binding.facts","completion":"immediate"}}
});

export const contract_0_1 = defineCapability({
  "id": "era.tavern.character",
  "targets": ["browser"],
  "display_name": "酒馆角色主开场白",
  "description": "只读或以真实 avatar 乐观更新当前单角色卡的 first_messages[0]；写入成功后仅刷新空聊天或恰好一条未污染主开场白，已有多楼、编辑/污染、备用开场白和群聊保持原样。",
  "operations": {"patch_single_floor":{"input_type":"era.tavern.character.single_floor.request","output_type":"era.tavern.character.single_floor.result","completion":"suspend"},"patch_external_statusbar":{"input_type":"era.tavern.character.external_statusbar.request","output_type":"era.tavern.character.external_statusbar.result","completion":"suspend"},"read_main_greeting":{"input_type":"era.tavern.character.read_main_greeting.request","output_type":"era.tavern.character.read_main_greeting.result","completion":"suspend"},"write_main_greeting":{"input_type":"era.tavern.character.write_main_greeting.request","output_type":"era.tavern.character.write_main_greeting.result","completion":"suspend"},"read_greeting_refresh_context":{"input_type":"era.tavern.character.read_main_greeting.request","output_type":"era.tavern.character.greeting_refresh.facts","completion":"immediate"},"apply_greeting_refresh":{"input_type":"era.tavern.character.greeting_refresh.plan","output_type":"era.tavern.character.greeting_refresh.result","completion":"suspend"}}
});

export const contract_0_2 = defineCapability({
  "id": "era.tavern.functions",
  "targets": ["browser"],
  "display_name": "消息内原生工具调用通道",
  "description": "通过酒馆接口启动已注册的作者工具，传递参数，并将其接口请求及 Service 应用回执按顺序交还。",
  "operations": {"begin":{"input_type":"era.working.request","output_type":"era.working.result","completion":"immediate"},"next":{"input_type":"era.working.request","output_type":"era.working.result","completion":"suspend"},"acknowledge":{"input_type":"era.working.request","output_type":"era.working.result","completion":"immediate"},"release":{"input_type":"era.working.request","output_type":"era.working.result","completion":"immediate"}}
});

export const contract_0_3 = defineCapability({
  "id": "era.tavern.identity",
  "targets": ["browser"],
  "display_name": "酒馆身份信息",
  "description": "同步读取当前角色、群组与聊天身份信息。",
  "operations": {"read":{"input_type":"era.tavern.identity.read.request","output_type":"era.tavern.identity.read.result","completion":"immediate"}}
});

export const contract_0_4 = defineCapability({
  "id": "era.tavern.installation_scope",
  "targets": ["browser"],
  "display_name": "ERA 安装作用域读取",
  "description": "读取当前脚本身份及角色卡、全局、预设中的启用脚本资料，供启动位置判断。",
  "operations": {"read":{"input_type":"era.tavern.installation_scope.read.request","output_type":"era.installation.scope.facts","completion":"immediate"}}
});

export const contract_0_5 = defineCapability({
  "id": "era.lifecycle.admission",
  "targets": ["browser"],
  "display_name": "执行域延迟准入",
  "description": "按服务传入的事件和合并保存期限安排宿主接收、等待及定时器，返回实际执行结果。",
  "operations": {"schedule":{"input_type":"era.working.request","output_type":"era.working.result","completion":"immediate"},"cancel":{"input_type":"era.working.request","output_type":"era.working.result","completion":"immediate"}}
});

export const contract_0_6 = defineCapability({
  "id": "era.tavern.messages",
  "targets": ["browser"],
  "display_name": "酒馆消息",
  "description": "读取消息上下文，并按工作流明确生成的计划更新内容和刷新消息。",
  "operations": {"read_context":{"input_type":"era.tavern.messages.read_context.request","output_type":"era.tavern.messages.read_context.result","completion":"suspend"},"update_content":{"input_type":"era.tavern.messages.update_content.request","output_type":"era.tavern.messages.update_content.result","completion":"suspend"},"refresh":{"input_type":"era.tavern.messages.refresh.request","output_type":"era.tavern.messages.refresh.result","completion":"suspend"}}
});

export const contract_0_7 = defineCapability({
  "id": "era.tavern.regex",
  "targets": ["browser"],
  "display_name": "酒馆正则资源",
  "description": "读取 ERA 角色正则资源，并以幂等方式创建或更新资源；写入状态栏正则时由 Host 为当前角色启用局部正则。",
  "operations": {"read":{"input_type":"era.tavern.regex.read.request","output_type":"era.tavern.regex.read.result","completion":"suspend"},"upsert":{"input_type":"era.tavern.regex.upsert.request","output_type":"era.tavern.regex.upsert.result","completion":"suspend"}}
});

export const contract_0_8 = defineCapability({
  "id": "era.tavern.sidecar",
  "targets": ["browser"],
  "display_name": "ERA 独立状态文件 宿主接线",
  "description": "提供当前聊天身份、用户文件和绑定选择弹窗的读写接口，供状态文件流程执行已选定操作。",
  "operations": {"read_current":{"input_type":"era.tavern.sidecar.read_current.request","output_type":"era.tavern.sidecar.read_current.result","completion":"suspend"},"read_record":{"input_type":"era.tavern.sidecar.read_record.request","output_type":"era.tavern.sidecar.read_record.result","completion":"suspend"},"write_record":{"input_type":"era.tavern.sidecar.write_record.request","output_type":"era.tavern.sidecar.write_record.result","completion":"suspend"},"commit_metadata":{"input_type":"era.tavern.sidecar.commit_metadata.request","output_type":"era.tavern.sidecar.commit_metadata.result","completion":"suspend"},"publish_snapshot":{"input_type":"era.tavern.sidecar.commit_metadata.request","output_type":"era.tavern.sidecar.commit_metadata.result","completion":"immediate"},"create_id":{"input_type":"era.tavern.sidecar.create_id.request","output_type":"era.tavern.sidecar.create_id.result","completion":"immediate"},"present_prompt":{"input_type":"era.tavern.sidecar.present_prompt.request","output_type":"era.tavern.sidecar.present_prompt.result","completion":"immediate"},"clear_prompt":{"input_type":"era.tavern.sidecar.clear_prompt.request","output_type":"era.tavern.sidecar.clear_prompt.result","completion":"immediate"},"read_working":{"input_type":"era.working.request","output_type":"era.working.result","completion":"immediate"},"write_working":{"input_type":"era.working.request","output_type":"era.working.result","completion":"immediate"}}
});

export const contract_0_9 = defineCapability({
  "id": "era.tavern.startup_gate",
  "targets": ["browser"],
  "display_name": "ERA 启动闸门",
  "description": "按服务的启动决定连接酒馆事件入口，或返回休眠结果及原因。",
  "operations": {"activate":{"input_type":"era.installation.scope.decision","output_type":"era.tavern.startup_gate.result","completion":"immediate"},"dormant":{"input_type":"era.installation.scope.decision","output_type":"era.tavern.startup_gate.result","completion":"immediate"}}
});

export const contract_0_10 = defineCapability({
  "id": "era.tavern.variables",
  "targets": ["browser"],
  "display_name": "酒馆变量",
  "description": "读取并按逻辑提交边界写入现有 ERA 状态、元数据、已选 MK 与编辑日志。",
  "operations": {"read":{"input_type":"era.tavern.variables.read.request","output_type":"era.tavern.variables.read.result","completion":"suspend"},"commit":{"input_type":"era.tavern.variables.commit.request","output_type":"era.tavern.variables.commit.result","completion":"suspend"}}
});

export const contract_0_11 = defineCapability({
  "id": "era.tavern.worldbook",
  "targets": ["browser"],
  "display_name": "酒馆世界书",
  "description": "通过明确的宿主操作读取、创建、绑定和替换 ERA 世界书条目。",
  "operations": {"read":{"input_type":"era.tavern.worldbook.read.request","output_type":"era.tavern.worldbook.read.result","completion":"suspend"},"create":{"input_type":"era.tavern.worldbook.create.request","output_type":"era.tavern.worldbook.create.result","completion":"suspend"},"bind":{"input_type":"era.tavern.worldbook.bind.request","output_type":"era.tavern.worldbook.bind.result","completion":"suspend"},"replace_entries":{"input_type":"era.tavern.worldbook.replace_entries.request","output_type":"era.tavern.worldbook.replace_entries.result","completion":"suspend"}}
});

export const contract_0_12 = defineDataSchema({
  "type_key": "era.tavern.character.single_floor.request",
  "representation": "json",
  "schema": {"type":"object","required":["characterId","enabled"],"properties":{"characterId":{"type":"string"},"enabled":{"type":"boolean"}}},
  "display_name": "角色卡单层显示设置请求",
  "description": "指定角色卡及其单层显示开关。"
});

export const contract_0_13 = defineDataSchema({
  "type_key": "era.tavern.character.single_floor.result",
  "representation": "json",
  "schema": {"type":"object"},
  "display_name": "角色卡单层显示设置结果",
  "description": "返回本次单层显示设置的宿主处理结果。"
});

export const contract_0_14 = defineDataSchema({
  "type_key": "era.agent.auxiliary.execution_request",
  "representation": "json",
  "display_name": "ERA 多阶段生成 辅助阶段执行请求",
  "description": "保存规划或结算阶段所需的角色配置、预设摘要和本机模型连接引用。连接使用方案标识及名称，供宿主找到实际连接配置。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false,"required":["schemaVersion","routedStep","executionState","hostContext","configurationVersion","migrationMode","configuration","stages","diagnostics"],"properties":{"schemaVersion":{"const":2},"routedStep":{"type":"object","additionalProperties":true},"executionState":{"type":"object","additionalProperties":true},"hostContext":{"oneOf":[{"type":"object","additionalProperties":true},{"type":"null"}]},"configurationVersion":{"oneOf":[{"enum":["1","2"]},{"type":"null"}]},"migrationMode":{"enum":["not-applicable","v1-preserved","v2"]},"configuration":{"type":"object","additionalProperties":true},"stages":{"type":"array","maxItems":2,"items":{"type":"object","additionalProperties":false,"required":["stage","enabled","retryCount","attempts"],"properties":{"stage":{"enum":["planning","settlement"]},"enabled":{"type":"boolean"},"retryCount":{"type":"integer","minimum":0,"maximum":16},"attempts":{"type":"array","minItems":1,"maxItems":17,"items":{"type":"object","additionalProperties":false,"required":["preset","modelSource"],"properties":{"preset":{"type":"object","additionalProperties":false,"required":["source"],"properties":{"source":{"enum":["builtin","snapshot"]},"sourceName":{"type":"string","maxLength":256},"orderedPrompts":{"type":"array","maxItems":256,"items":{"oneOf":[{"type":"string"},{"type":"object","additionalProperties":true}]}},"settings":{"type":"object","additionalProperties":true}}},"modelSource":{"type":"object","additionalProperties":false,"required":["kind"],"properties":{"kind":{"enum":["tavern-current","custom-profile"]},"profileId":{"type":"string","minLength":1,"maxLength":256},"profileNameHint":{"type":"string","maxLength":256},"model":{"type":"string","minLength":1,"maxLength":512},"legacyModelOverride":{"type":"string","minLength":1,"maxLength":512}}}}}}}}},"diagnostics":{"type":"array","maxItems":128,"items":{"type":"object","additionalProperties":false,"required":["code","message"],"properties":{"code":{"type":"string","minLength":1,"maxLength":256},"message":{"type":"string","maxLength":4096}}}}}}
});

export const contract_0_15 = defineDataSchema({
  "type_key": "era.agent.candidate.done",
  "display_name": "本阶段是否已成功或无法继续",
  "representation": "json",
  "schema": {"type":"boolean"},
  "description": "为真时结束候选重试循环；为假时使用更新后的请求再试一次。"
});

export const contract_0_16 = defineDataSchema({
  "type_key": "era.agent.candidate.outcome",
  "display_name": "候选循环最终结果",
  "representation": "json",
  "schema": {"type":"object","additionalProperties":true},
  "description": "候选完成后交给生成会话的结果；内部重试请求不向外传播。"
});

export const contract_0_17 = defineDataSchema({
  "type_key": "era.agent.candidate.state.next",
  "display_name": "本次尝试后的进度及重试请求",
  "representation": "json",
  "schema": {"type":"object","additionalProperties":false,"required":["request","step","executionState"],"properties":{"request":{"type":"object","additionalProperties":true},"step":{"type":"object","additionalProperties":true},"executionState":{"type":"object","additionalProperties":true}}},
  "description": "保留步骤与批次状态，并在需要重试时替换生成请求。"
});

export const contract_0_18 = defineDataSchema({
  "type_key": "era.agent.candidate.state",
  "display_name": "本次模型尝试的请求、起点和进度",
  "representation": "json",
  "schema": {"type":"object","additionalProperties":false,"required":["request","step","executionState"],"properties":{"request":{"type":"object","additionalProperties":true},"step":{"type":"object","additionalProperties":true},"executionState":{"type":"object","additionalProperties":true}}},
  "description": "保存本次候选的生成请求、已准备步骤和所属批次状态。"
});

export const contract_0_19 = defineDataSchema({
  "type_key": "era.agent.connection.state",
  "representation": "json",
  "display_name": "本机连接公开事实",
  "description": "当前记录数、查找键存在性与有效记录摘要，不包含秘密值。",
  "schema": {"type":"object","required":["entryCount","entryExists","profile"],"additionalProperties":false,"properties":{"entryCount":{"type":"integer","minimum":0},"entryExists":{"type":"boolean"},"profile":{"type":["object","null"],"properties":{"id":{"type":"string"},"name":{"type":"string"},"apiUrl":{"type":"string"},"hasKey":{"type":"boolean"}},"required":["id","name","apiUrl","hasKey"],"additionalProperties":false}}}
});
