import {defineDataSchema} from "@vibeflow/plugin";

export const contract_12_0 = defineDataSchema({
  "type_key": "era.fatal.route",
  "representation": "json",
  "display_name": "ERA·致命状态·路由",
  "description": "定义“ERA·致命状态·路由”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string","enum":["continue","fatal"]}
});

export const contract_12_1 = defineDataSchema({
  "type_key": "era.tavern.character.greeting_refresh.facts",
  "representation": "json",
  "display_name": "当前开场白及首条消息资料",
  "description": "原初始化提交中的刷新事实、计划及结果。",
  "schema": {"type":"object","required":["group","tainted","length","first"],"properties":{"group":{"type":"boolean"},"tainted":{"type":"boolean"},"length":{"type":"integer"},"first":{"type":["object","null"],"additionalProperties":true}},"additionalProperties":false}
});

export const contract_12_2 = defineDataSchema({
  "type_key": "era.tavern.character.greeting_refresh.plan",
  "representation": "json",
  "display_name": "首条消息更新、新建或保留计划",
  "description": "原初始化提交中的刷新事实、计划及结果。",
  "schema": {"type":"object","required":["kind","next"],"properties":{"kind":{"enum":["empty","message"]},"next":{"type":"string"},"updated":{"type":"string"}},"additionalProperties":false}
});

export const contract_12_3 = defineDataSchema({
  "type_key": "era.tavern.character.greeting_refresh.result",
  "representation": "json",
  "display_name": "首条消息刷新结果",
  "description": "原初始化提交中的刷新事实、计划及结果。",
  "schema": {"type":"object","required":["status","reason"],"properties":{"status":{"enum":["refreshed","preserved","not-applicable"]},"reason":{"type":"string"}},"additionalProperties":false}
});

export const contract_12_4 = defineDataSchema({
  "type_key": "era.initialize.changes",
  "representation": "json",
  "display_name": "ERA·初始化·变更",
  "description": "定义“ERA·初始化·变更”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_12_5 = defineDataSchema({
  "type_key": "era.initialize.commit.request",
  "representation": "json",
  "display_name": "ERA·初始化·提交·请求",
  "description": "定义“ERA·初始化·提交·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_12_6 = defineDataSchema({
  "type_key": "era.initialize.commit.result",
  "representation": "json",
  "display_name": "ERA·初始化·提交·结果",
  "description": "定义“ERA·初始化·提交·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_12_7 = defineDataSchema({
  "type_key": "era.initialize.completion.route",
  "representation": "json",
  "display_name": "初始化完成路由",
  "description": "选择直接结算或继续启动同步。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string","enum":["sync","finish"]}
});

export const contract_12_8 = defineDataSchema({
  "type_key": "era.initialize.context",
  "representation": "json",
  "display_name": "ERA·初始化·上下文",
  "description": "定义“ERA·初始化·上下文”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_12_9 = defineDataSchema({
  "type_key": "era.initialize.direct.result",
  "representation": "json",
  "display_name": "直接初始化结果",
  "description": "保存资源初始化或设置更新的实际结果，供无需后续历史同步的分支直接返回。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_12_10 = defineDataSchema({
  "type_key": "era.initialize.plan",
  "representation": "json",
  "display_name": "ERA·初始化·计划",
  "description": "定义“ERA·初始化·计划”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_12_11 = defineDataSchema({
  "type_key": "era.initialize.route",
  "representation": "json",
  "display_name": "ERA·初始化·路由",
  "description": "定义“ERA·初始化·路由”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string","enum":["no-op","reconcile"]}
});

export const contract_12_12 = defineDataSchema({
  "type_key": "era.initialize.startup.sync.step",
  "representation": "json",
  "display_name": "启动同步步骤",
  "description": "初始化分支专用的启动同步步骤，在进入共享 sync Nodeset 前转为通用 routed step。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_12_13 = defineDataSchema({
  "type_key": "era.installation.scope.classification",
  "representation": "json",
  "display_name": "ERA 安装作用域分类",
  "description": "纯规则对启动期脚本归属的分类结果。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["status","reason"],"additionalProperties":false,"properties":{"status":{"enum":["character","global","preset","ambiguous","unknown"]},"reason":{"type":"string","minLength":1}}}
});

export const contract_12_14 = defineDataSchema({
  "type_key": "era.installation.scope.decision",
  "representation": "json",
  "display_name": "ERA 安装作用域启动决议",
  "description": "启动前 workflow 返回给组合层的允许或休眠决议及提示要求。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["classification","route","warn"],"additionalProperties":false,"properties":{"classification":{"enum":["character","global","preset","ambiguous","unknown"]},"route":{"enum":["allow","dormant"]},"warn":{"type":"boolean"}}}
});

export const contract_12_15 = defineDataSchema({
  "type_key": "era.installation.scope.facts",
  "representation": "json",
  "display_name": "ERA 安装作用域事实",
  "description": "启动期 Host 对当前脚本 ID 与各作用域启用归属的只读采样。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["scriptId","scopes","readStatus"],"additionalProperties":false,"properties":{"scriptId":{"type":["string","null"]},"scopes":{"type":"array","items":{"enum":["character","global","preset"]}},"readStatus":{"enum":["complete","unavailable","failed"]}}}
});

export const contract_12_16 = defineDataSchema({
  "type_key": "era.installation.scope.route",
  "representation": "json",
  "display_name": "ERA 安装作用域路由",
  "description": "主 workflow 的启动分支路由。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string","enum":["allow","dormant"]}
});

export const contract_12_17 = defineDataSchema({
  "type_key": "era.iteration.route",
  "representation": "json",
  "display_name": "ERA·迭代·路由",
  "description": "定义“ERA·迭代·路由”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string","enum":["wait","execute"]}
});

export const contract_12_18 = defineDataSchema({
  "type_key": "era.mk.candidate.routed",
  "representation": "json",
  "display_name": "已路由 ERA 消息历史标识候选",
  "description": "路由节点无损转发的 MK 候选；形状与 era.mk.candidate 完全一致。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["schemaVersion","step","disposition","mk","messageUpdate","metaUpdate","messageWriteRequired","variableWriteRequired","failure"],"properties":{"schemaVersion":{"const":1},"step":{"type":"object"},"disposition":{"type":"string","enum":["ready","failed"]},"mk":{"type":["string","null"]},"messageUpdate":{"type":["object","null"]},"metaUpdate":{"type":["object","null"]},"messageWriteRequired":{"type":"boolean"},"variableWriteRequired":{"type":"boolean"},"failure":{"type":["object","null"]}},"additionalProperties":false}
});

export const contract_12_19 = defineDataSchema({
  "type_key": "era.mk.candidate",
  "representation": "json",
  "display_name": "ERA 消息历史标识提交候选",
  "description": "纯计算产生的消息文本与 ERAMetaData 候选，或进入无写入失败路径的明确错误。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["schemaVersion","step","disposition","mk","messageUpdate","metaUpdate","messageWriteRequired","variableWriteRequired","failure"],"properties":{"schemaVersion":{"const":1},"step":{"type":"object"},"disposition":{"type":"string","enum":["ready","failed"]},"mk":{"type":["string","null"]},"messageUpdate":{"type":["object","null"],"properties":{"messageId":{"type":"integer","minimum":0},"content":{"type":"string"}},"required":["messageId","content"],"additionalProperties":false},"metaUpdate":{"type":["object","null"]},"messageWriteRequired":{"type":"boolean"},"variableWriteRequired":{"type":"boolean"},"failure":{"type":["object","null"]}},"additionalProperties":false}
});
