import {defineDataSchema} from "@vibeflow/plugin";

export const contract_4_0 = defineDataSchema({
  "type_key": "era.task.action.route",
  "display_name": "这项任务接下来要执行的动作",
  "representation": "json",
  "schema": {"type":"string","enum":["commit","sync","candidate","simple","update-mk","direct"]}
});

export const contract_4_1 = defineDataSchema({
  "type_key": "era.task.completion.route",
  "representation": "json",
  "display_name": "外层结算分支",
  "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。",
  "schema": {"type":"string","enum":["api","ordinary"]}
});

export const contract_4_2 = defineDataSchema({
  "type_key": "era.task.continuation.context",
  "representation": "json",
  "display_name": "原任务接续上下文",
  "description": "保留原步骤、来源与批次和 API/生成适配依据，执行返回后才结算；不是跨迭代持久化状态。",
  "schema": {"type":"object","properties":{"origin":{"type":"string","enum":["sync","initialize","api","agent"]},"step":{"type":"object"},"executionState":{"type":"object"},"apiContext":{"type":["object","null"]},"initializationContext":{"type":["object","null"]},"agentContext":{"type":["object","null"]}},"required":["origin","step","executionState"],"additionalProperties":false}
});

export const contract_4_3 = defineDataSchema({
  "type_key": "era.task.entry.route",
  "representation": "json",
  "display_name": "任务入口",
  "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。",
  "schema": {"type":"string","enum":["initialize","api","agent","sync","simple"]}
});

export const contract_4_4 = defineDataSchema({
  "type_key": "era.task.execution.request",
  "representation": "json",
  "display_name": "共享执行流程执行请求",
  "description": "保存选定的提交、历史同步、生成候选或直接返回请求，以及原任务回执资料。",
  "schema": {"type":"object","properties":{"kind":{"type":"string","enum":["sync","commit","candidate","update-mk","direct"]},"payload":{"type":"object"}},"required":["kind","payload"],"additionalProperties":false}
});

export const contract_4_5 = defineDataSchema({
  "type_key": "era.task.execution.result",
  "representation": "json",
  "display_name": "核心执行结果与原任务",
  "description": "只在核心真实执行或准备明确直接结果后产生，供恢复原 API 或任务回执，不重复业务计算。",
  "schema": {"type":"object","properties":{"kind":{"type":"string","enum":["sync","commit","direct","update-mk"]},"value":{"type":"object"},"continuation":{"type":"object"}},"required":["kind","value","continuation"],"additionalProperties":false}
});

export const contract_4_6 = defineDataSchema({
  "type_key": "era.task.execution.route",
  "representation": "json",
  "display_name": "执行分支",
  "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。",
  "schema": {"type":"string","enum":["sync","commit","candidate","update-mk","direct"]}
});

export const contract_4_7 = defineDataSchema({
  "type_key": "era.task.family.route",
  "representation": "json",
  "display_name": "ERA 服务任务族路由",
  "description": "统一准备后，仅用于选择 Service 直属复杂任务或简单任务分支；原 PlannedStep 任务路由保持独立。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string","enum":["initialize","api","agent-generation-session","simple"]}
});

export const contract_4_8 = defineDataSchema({
  "type_key": "era.task.prepared",
  "representation": "json",
  "display_name": "任务准备结果",
  "description": "保存已经准备好、接下来需要执行的请求，以及原任务、事件来源和批次资料。",
  "schema": {"type":"object","properties":{"request":{"type":"object"},"continuation":{"type":"object"}},"required":["request","continuation"],"additionalProperties":false}
});

export const contract_4_9 = defineDataSchema({
  "type_key": "era.task.result",
  "representation": "json",
  "display_name": "ERA 任务结果",
  "description": "保存单个任务的实际状态、原事件回执、页面通知和诊断，供批次汇总。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"status":{"type":"string","enum":["committed","deferred","no-op","failed","fatal"]},"settlements":{"type":"array","maxItems":128,"items":{"oneOf":[{"type":"object","properties":{"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"status":{"const":"completed"},"taskId":{"type":"string","minLength":1},"relation":{"type":"string","enum":["primary","combined","coalesced"]},"value":{}},"required":["eventId","sequence","status","taskId","relation"],"additionalProperties":false},{"type":"object","properties":{"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"status":{"const":"ignored"},"reason":{"type":"string","minLength":1}},"required":["eventId","sequence","status","reason"],"additionalProperties":false},{"type":"object","properties":{"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"status":{"const":"failed"},"error":{"type":"object","properties":{"code":{"type":"string","minLength":1},"message":{"type":"string"},"category":{"type":"string","enum":["input","domain","tavern","cancelled"]},"retryable":{"type":"boolean"},"details":{"type":"object","additionalProperties":true}},"required":["code","message","category","retryable"],"additionalProperties":false}},"required":["eventId","sequence","status","error"],"additionalProperties":false},{"type":"object","properties":{"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"status":{"const":"cancelled"},"reason":{"type":"string","minLength":1}},"required":["eventId","sequence","status","reason"],"additionalProperties":false}]}},"notifications":{"type":"array","items":{"type":"object","properties":{"type":{"type":"string","minLength":1},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}}},"required":["type","args"],"additionalProperties":false}},"diagnostics":{"type":"array","items":{"type":"object","properties":{"code":{"type":"string","minLength":1},"message":{"type":"string"},"sequence":{"oneOf":[{"type":"integer","minimum":1},{"type":"null"}]}},"required":["code","message","sequence"],"additionalProperties":false}},"stateUpdate":{"type":"object","properties":{"consecutiveMk":{"oneOf":[{"type":"string","minLength":1},{"type":"null"}]},"consecutiveProcessingCount":{"type":"integer","minimum":0},"syncCursor":{"oneOf":[{"type":"null"},{"type":"object","properties":{"messageId":{"type":"integer","minimum":0},"mk":{"type":"string","minLength":1},"blockIndex":{"type":"integer","minimum":0}},"required":["messageId","mk","blockIndex"],"additionalProperties":false}]},"scopeWindow":{"type":"object","properties":{"token":{"oneOf":[{"type":"integer","minimum":1},{"type":"null"}]},"messageId":{"oneOf":[{"type":"integer","minimum":0},{"type":"null"}]},"messageAdmission":{"oneOf":[{"type":"boolean"},{"type":"null"}]},"branchAdmission":{"oneOf":[{"type":"boolean"},{"type":"null"}]}},"required":["token","messageId","messageAdmission","branchAdmission"],"additionalProperties":false}},"required":["consecutiveMk","consecutiveProcessingCount"],"additionalProperties":false}},"required":["status","settlements","notifications","diagnostics"],"additionalProperties":false}
});

export const contract_4_10 = defineDataSchema({
  "type_key": "era.task.route",
  "representation": "json",
  "display_name": "ERA 任务路由",
  "description": "显式区分初始化、同步、API、MK 更新、Agent 生成会话与忽略步骤。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string","enum":["initialize","sync","api","update-mk","agent-generation-session","ignore","agent-settings"]}
});

export const contract_4_11 = defineDataSchema({
  "type_key": "era.tavern.character.external_statusbar.request",
  "representation": "json",
  "schema": {"type":"object"},
  "display_name": "角色卡外置状态栏请求",
  "description": "向酒馆宿主请求读取或设置角色卡外置状态栏。"
});

export const contract_4_12 = defineDataSchema({
  "type_key": "era.tavern.character.external_statusbar.result",
  "representation": "json",
  "schema": {"type":"object"},
  "display_name": "角色卡外置状态栏结果",
  "description": "返回酒馆宿主处理外置状态栏请求的结果。"
});

export const contract_4_13 = defineDataSchema({
  "type_key": "era.tavern.character.read_main_greeting.request",
  "representation": "json",
  "display_name": "ERA·酒馆·角色·读取主开场白·请求",
  "description": "读取当前角色主开场白的机械请求。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_4_14 = defineDataSchema({
  "type_key": "era.tavern.character.read_main_greeting.result",
  "representation": "json",
  "display_name": "ERA·酒馆·角色·读取主开场白·结果",
  "description": "当前角色主开场白的可移植投影。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_4_15 = defineDataSchema({
  "type_key": "era.tavern.character.write_main_greeting.request",
  "representation": "json",
  "display_name": "ERA·酒馆·角色·写入主开场白·请求",
  "description": "包含期望旧值与目标新值的主开场白乐观更新请求。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_4_16 = defineDataSchema({
  "type_key": "era.tavern.character.write_main_greeting.result",
  "representation": "json",
  "display_name": "ERA·酒馆·角色·写入主开场白·结果",
  "description": "主开场白写入确认与回读结果。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_4_17 = defineDataSchema({
  "type_key": "era.tavern.commit.request",
  "representation": "json",
  "display_name": "ERA·酒馆·提交·请求",
  "description": "定义“ERA·酒馆·提交·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_4_18 = defineDataSchema({
  "type_key": "era.tavern.commit.result",
  "representation": "json",
  "display_name": "ERA·酒馆·提交·结果",
  "description": "定义“ERA·酒馆·提交·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_4_19 = defineDataSchema({
  "type_key": "era.tavern.identity.read.request",
  "representation": "json",
  "display_name": "ERA·酒馆·身份·读取·请求",
  "description": "定义“ERA·酒馆·身份·读取·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});
