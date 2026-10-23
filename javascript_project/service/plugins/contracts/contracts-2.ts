import {defineDataSchema} from "@vibeflow/plugin";

export const contract_1_0 = defineDataSchema({
  "type_key": "era.agent.function_call.result",
  "representation": "json",
  "display_name": "ERA 多阶段生成 纯函数调用结果",
  "description": "按调用顺序保存已计算函数的名称、数值、消息历史标识和随机使用范围，供生成阶段整理结果。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false,"required":["schemaVersion","status","messageMk","drawStart","drawEnd","calls","diagnostics"],"properties":{"schemaVersion":{"const":1},"status":{"enum":["ready","planning-exhausted","failed","cancelled"]},"messageMk":{"oneOf":[{"type":"string","minLength":1,"maxLength":512},{"type":"null"}]},"drawStart":{"type":"integer","minimum":0},"drawEnd":{"type":"integer","minimum":0},"calls":{"type":"array","maxItems":32,"items":{"type":"object","additionalProperties":false,"required":["index","function","args","result"],"properties":{"index":{"type":"integer","minimum":0,"maximum":31},"function":{"type":"string","minLength":1,"maxLength":256},"args":{"type":"array","maxItems":32,"items":{"type":"number"}},"result":{"oneOf":[{"type":"number"},{"type":"null"}]}}}},"diagnostics":{"type":"array","maxItems":128,"items":{"type":"string","maxLength":4096}}}}
});

export const contract_1_1 = defineDataSchema({
  "type_key": "era.agent.generation.decision",
  "display_name": "生成阶段决策",
  "representation": "json",
  "schema": {"type":"object","additionalProperties":true},
  "description": "记录当前生成事件应继续执行、恢复还是直接结算。"
});

export const contract_1_2 = defineDataSchema({
  "type_key": "era.agent.generation.facts",
  "display_name": "生成事件与会话事实",
  "representation": "json",
  "schema": {"type":"object","additionalProperties":true},
  "description": "汇集生成事件、来源及当前会话状态供阶段判断。"
});

export const contract_1_3 = defineDataSchema({
  "type_key": "era.agent.generation.outcome",
  "display_name": "生成阶段执行结果",
  "representation": "json",
  "schema": {"type":"object","additionalProperties":true},
  "description": "记录一次生成阶段的执行结果与后续阶段所需事实。"
});

export const contract_1_4 = defineDataSchema({
  "type_key": "era.agent.generation.raw",
  "display_name": "尚未应用的生成输出",
  "representation": "json",
  "schema": {"type":"object","additionalProperties":true},
  "description": "保留模型原文，待共用块执行流程按位置应用。"
});

export const contract_1_5 = defineDataSchema({
  "type_key": "era.agent.generation.request",
  "display_name": "生成阶段所需输入",
  "representation": "json",
  "schema": {"type":"object","additionalProperties":true},
  "description": "保存本阶段发给模型的请求及继续执行所需上下文。"
});

export const contract_1_6 = defineDataSchema({
  "type_key": "era.agent.host.request",
  "representation": "json",
  "display_name": "ERA 多阶段生成 宿主请求",
  "description": "保存 Service 要求酒馆或模型接口执行的具体生成、设置或页面操作，供宿主调用。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true,"properties":{"requestPolicy":{"type":"object","required":["binding","sampling"],"additionalProperties":false,"properties":{"binding":{"type":"object","required":["kind","profileId","model"],"properties":{"kind":{"enum":["custom-profile","tavern-current"]},"profileId":{},"model":{"type":["string","null"]}},"additionalProperties":false},"sampling":{"type":"object","required":["maxTokens","temperature","frequencyPenalty","presencePenalty","topP","topK"],"properties":{"maxTokens":{"anyOf":[{"type":"number"},{"const":"same_as_preset"}]},"temperature":{"anyOf":[{"type":"number"},{"const":"same_as_preset"}]},"frequencyPenalty":{"anyOf":[{"type":"number"},{"const":"same_as_preset"}]},"presencePenalty":{"anyOf":[{"type":"number"},{"const":"same_as_preset"}]},"topP":{"anyOf":[{"type":"number"},{"const":"same_as_preset"}]},"topK":{"anyOf":[{"type":"number"},{"const":"same_as_preset"}]}},"additionalProperties":false}}},"sourceId":{"type":["string","null"]},"keyMode":{"enum":["clear","replace-if-nonempty-otherwise-preserve"]},"status":{"enum":["created","updated"]}}}
});

export const contract_1_7 = defineDataSchema({
  "type_key": "era.agent.host.result",
  "representation": "json",
  "display_name": "ERA 多阶段生成 宿主结果",
  "description": "Agent Host capability 返回的脱敏、可序列化、有界事实或模型原文。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true,"properties":{"requestedName":{"type":"string"},"loadedName":{"type":["string","null"]},"prompts":{"type":"array","maxItems":256,"items":{"type":"object","required":["id","enabled","role","content"],"properties":{"id":{"type":["string","null"]},"enabled":{"type":"boolean"},"role":{"type":["string","null"]},"content":{"type":["string","null"]}},"additionalProperties":false}}}}
});

export const contract_1_8 = defineDataSchema({
  "type_key": "era.agent.planning.attempt_result",
  "representation": "json",
  "display_name": "ERA 规划尝试结果",
  "description": "保存有界规划尝试、严格故事计划、最多 32 项函数调用表及可定位诊断。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false,"required":["schemaVersion","status","attempts","storyPlan","calls"],"properties":{"schemaVersion":{"const":1},"status":{"enum":["ready","exhausted","failed","cancelled"]},"attempts":{"type":"array","maxItems":17,"items":{"type":"object","additionalProperties":false,"required":["index","output","diagnostics"],"properties":{"index":{"type":"integer","minimum":0,"maximum":16},"output":{"type":"string","maxLength":262144},"diagnostics":{"type":"array","maxItems":128,"items":{"type":"string","maxLength":4096}}}}},"storyPlan":{"oneOf":[{"type":"object","additionalProperties":true},{"type":"null"}]},"calls":{"type":"array","maxItems":32,"items":{"type":"object","additionalProperties":false,"required":["function","args"],"properties":{"function":{"type":"string","minLength":1,"maxLength":256},"args":{"type":"array","maxItems":32,"items":{"type":"number"}},"purpose":{"type":"string","maxLength":4096}}}}}}
});

export const contract_1_9 = defineDataSchema({
  "type_key": "era.agent.session.binding.facts",
  "representation": "json",
  "display_name": "会话关联即时事实",
  "description": "原生生成是否活动及旧会话关联字段，不含宿主控制器。",
  "schema": {"type":"object","required":["active","previous"],"additionalProperties":false,"properties":{"active":{"type":"boolean"},"previous":{"type":["object","null"],"properties":{"execution":{},"storyRequestId":{},"nativeGeneration":{}},"additionalProperties":false}}}
});

export const contract_1_10 = defineDataSchema({
  "type_key": "era.agent.session.context",
  "representation": "json",
  "display_name": "ERA 故事生成会话上下文",
  "description": "Service 从已路由事件与 Host 脱敏投影组合出的有界角色卡、聊天、分支、消息、配置和活动会话上下文。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false,"required":["schemaVersion","eventType","chatKey","branchKey","speakerKey","messageId","swipeIndex","revision","configuration","session"],"properties":{"schemaVersion":{"const":1},"eventType":{"type":"string","minLength":1,"maxLength":128},"chatKey":{"type":"string","minLength":1,"maxLength":512},"branchKey":{"type":"string","minLength":1,"maxLength":512},"speakerKey":{"type":"string","minLength":1,"maxLength":512},"messageId":{"oneOf":[{"type":"integer","minimum":0},{"type":"null"}]},"swipeIndex":{"oneOf":[{"type":"integer","minimum":0},{"type":"null"}]},"revision":{"type":"string","minLength":1,"maxLength":512},"configuration":{"type":"object","additionalProperties":true},"session":{"oneOf":[{"type":"object","additionalProperties":true},{"type":"null"}]}}}
});

export const contract_1_11 = defineDataSchema({
  "type_key": "era.agent.session.route",
  "representation": "json",
  "display_name": "ERA 故事生成会话路由",
  "description": "把四种阶段模式折叠为委托原任务或直接结算两条互斥工作流分支；完整模式仍保留在 transition 中。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string","enum":["legacy","direct"]}
});

export const contract_1_12 = defineDataSchema({
  "type_key": "era.agent.session.transition",
  "representation": "json",
  "display_name": "ERA 故事生成会话转换结果",
  "description": "统一承载默认委托、阶段推进、设置保存、取消和失败后的会话状态更新与任务结算候选。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false,"required":["schemaVersion","step","mode","status","diagnostics"],"properties":{"schemaVersion":{"const":1},"step":{"type":"object","additionalProperties":true},"mode":{"enum":["legacy","legacy-ignore","execute-legacy","execute-only"]},"status":{"enum":["committed","no-op","failed"]},"value":{},"diagnostics":{"type":"array","maxItems":128,"items":{"type":"object","additionalProperties":false,"required":["code","message"],"properties":{"code":{"type":"string","minLength":1,"maxLength":256},"message":{"type":"string","maxLength":4096}}}},"handoff":{"type":"object","additionalProperties":false,"required":["executionId","completionId","trigger","chatKey","stage","result"],"properties":{"executionId":{"type":"string"},"completionId":{"type":"string"},"trigger":{"type":"string"},"chatKey":{"type":"string"},"stage":{"enum":["planning","story","settlement"]},"result":{"type":"object","additionalProperties":true},"messageId":{"type":"integer","minimum":0},"mk":{"type":"string"},"swipeId":{"type":"integer","minimum":0}}}}}
});

export const contract_1_13 = defineDataSchema({
  "type_key": "era.agent.settings.outcome",
  "display_name": "多阶段生成 设置命令结果",
  "representation": "json",
  "schema": {"type":"object","additionalProperties":true},
  "description": "记录配置、预设、连接或模型列表命令的处理结果。"
});

export const contract_1_14 = defineDataSchema({
  "type_key": "era.agent.settings.request",
  "display_name": "多阶段生成 设置命令请求",
  "representation": "json",
  "schema": {"type":"object","additionalProperties":true},
  "description": "保存已识别的设置命令及执行所需上下文。"
});

export const contract_1_15 = defineDataSchema({
  "type_key": "era.agent.settlement.attempt_result",
  "representation": "json",
  "display_name": "ERA 变量分析尝试结果",
  "description": "保存有界变量分析尝试、最终分析文本、候选有序 operations 与精确诊断。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false,"required":["schemaVersion","status","attempts","analysis","operations"],"properties":{"schemaVersion":{"const":1},"status":{"enum":["ready","exhausted","failed","cancelled"]},"attempts":{"type":"array","maxItems":17,"items":{"type":"object","additionalProperties":false,"required":["index","output","diagnostics"],"properties":{"index":{"type":"integer","minimum":0,"maximum":16},"output":{"type":"string","maxLength":262144},"diagnostics":{"type":"array","maxItems":128,"items":{"type":"string","maxLength":4096}}}}},"analysis":{"oneOf":[{"type":"string","maxLength":262144},{"type":"null"}]},"operations":{"type":"array","maxItems":128,"items":{"type":"object","additionalProperties":true}}}}
});

export const contract_1_16 = defineDataSchema({
  "type_key": "era.agent.settlement.validated",
  "representation": "json",
  "display_name": "ERA 已校验变量结算",
  "description": "保存生成阶段分析后可应用的消息命令，或本次尚未完成变量结算的状态与原因。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false,"required":["schemaVersion","status","operations","eraTx","diagnostics"],"properties":{"schemaVersion":{"const":1},"status":{"enum":["ready","unsettled","failed","cancelled"]},"operations":{"type":"array","maxItems":128,"items":{"type":"object","additionalProperties":true}},"eraTx":{"oneOf":[{"type":"string","minLength":1,"maxLength":1048576,"pattern":"^<era_tx s=\\\"m\\\">"},{"type":"null"}]},"diagnostics":{"type":"array","maxItems":128,"items":{"type":"string","maxLength":4096}}}}
});

export const contract_1_17 = defineDataSchema({
  "type_key": "era.agent.story.capture",
  "representation": "json",
  "display_name": "ERA 多阶段生成 故事捕获",
  "description": "保存当前 Swipe 的干净故事、被隔离的故事模型 ERA 标签、故事前状态引用及计划函数证据。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false,"required":["schemaVersion","messageId","swipeIndex","revision","story","isolatedEraTags","baseline"],"properties":{"schemaVersion":{"const":1},"messageId":{"type":"integer","minimum":0},"swipeIndex":{"type":"integer","minimum":0},"revision":{"type":"string","minLength":1,"maxLength":512},"story":{"type":"string","maxLength":1048576},"isolatedEraTags":{"type":"array","maxItems":256,"items":{"type":"string","maxLength":262144}},"baseline":{"type":"object","additionalProperties":true}}}
});

export const contract_1_18 = defineDataSchema({
  "type_key": "era.api.commit.admission.route",
  "representation": "json",
  "display_name": "即时 变量提交 准入路由",
  "description": "选择 commit、skipped 或 failed。",
  "schema": {"type":"string","enum":["commit","skipped","failed"]}
});

export const contract_1_19 = defineDataSchema({
  "type_key": "era.api.commit.failure_context",
  "representation": "json",
  "display_name": "即时 变量提交 失败上下文",
  "description": "校验、窗口或消息失败的结构化上下文。",
  "schema": {"type":"object","additionalProperties":true}
});
