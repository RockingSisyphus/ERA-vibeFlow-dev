import {defineDataSchema} from "@vibeflow/plugin";

export const contract_13_0 = defineDataSchema({
  "type_key": "era.mk.commit.request",
  "representation": "json",
  "display_name": "ERA 消息历史标识提交请求",
  "description": "声明先消息后变量的单次逻辑提交所需的明确文本更新、完整 ERAMetaData 与写入标记。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["schemaVersion","step","mk","messageUpdate","metaUpdate","messageWriteRequired","variableWriteRequired"],"properties":{"schemaVersion":{"const":1},"step":{"type":"object"},"mk":{"type":"string","minLength":1},"messageUpdate":{"type":["object","null"],"properties":{"messageId":{"type":"integer","minimum":0},"content":{"type":"string"}},"required":["messageId","content"],"additionalProperties":false},"metaUpdate":{"type":"object"},"messageWriteRequired":{"type":"boolean"},"variableWriteRequired":{"type":"boolean"}},"additionalProperties":false}
});

export const contract_13_1 = defineDataSchema({
  "type_key": "era.mk.commit.result",
  "representation": "json",
  "display_name": "ERA 消息历史标识提交结果",
  "description": "记录 no-op、committed、普通失败或 fatal，以及消息与变量两部分是否已经确认写入。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["schemaVersion","step","status","mk","messageChanged","variablesChanged","failure"],"properties":{"schemaVersion":{"const":1},"step":{"type":"object"},"status":{"type":"string","enum":["committed","deferred","no-op","failed","fatal"]},"mk":{"type":["string","null"]},"messageChanged":{"type":"boolean"},"variablesChanged":{"type":"boolean"},"failure":{"type":["object","null"],"properties":{"code":{"type":"string","minLength":1},"message":{"type":"string","minLength":1},"category":{"type":"string","enum":["input","domain","tavern","cancelled"]},"retryable":{"const":false}},"required":["code","message","category","retryable"]}},"additionalProperties":false}
});

export const contract_13_2 = defineDataSchema({
  "type_key": "era.mk.context",
  "representation": "json",
  "display_name": "ERA 消息历史标识读取上下文",
  "description": "包含完整 update-mk 步骤、当前激活消息文本、ERAMetaData、状态占位符设置或读取失败；不携带身份或其他宿主状态。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["schemaVersion","step","status","message","meta","placeholderSettings","failure"],"properties":{"schemaVersion":{"const":1},"step":{"type":"object"},"status":{"type":"string","enum":["ready","failed"]},"message":{"type":["object","null"],"properties":{"messageId":{"type":"integer","minimum":0},"role":{"type":"string","minLength":1},"activeText":{"type":"string"}},"required":["messageId","role","activeText"]},"meta":{"type":["object","null"]},"placeholderSettings":{"type":["object","null"],"properties":{"enabled":{"type":"boolean"},"value":{"type":"string"}},"required":["enabled","value"],"additionalProperties":false},"failure":{"type":["object","null"],"properties":{"code":{"type":"string","minLength":1},"message":{"type":"string","minLength":1},"category":{"type":"string","enum":["input","domain","tavern","cancelled"]},"retryable":{"const":false}},"required":["code","message","category","retryable"]}},"additionalProperties":false}
});

export const contract_13_3 = defineDataSchema({
  "type_key": "era.mk.route",
  "representation": "json",
  "display_name": "ERA 消息历史标识提交路由",
  "description": "选择不触及宿主状态的 no-op 分支或执行逻辑提交的 commit 分支。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string","enum":["no-op","commit"]}
});

export const contract_13_4 = defineDataSchema({
  "type_key": "era.service.cycle.completion_route",
  "representation": "json",
  "display_name": "单步完成分支",
  "schema": {"type":"string","enum":["continue","finish"]},
  "description": "区分继续执行下一步骤与结束当前批次。"
});

export const contract_13_5 = defineDataSchema({
  "type_key": "era.service.cycle.route",
  "representation": "json",
  "display_name": "服务阶段分支",
  "schema": {"type":"string","enum":["collect","execute"]},
  "description": "区分等待并收集事件与执行已规划批次。"
});

export const contract_13_6 = defineDataSchema({
  "type_key": "era.service.cycle.routed",
  "representation": "json",
  "display_name": "Service 阶段路由中的状态",
  "description": "阶段路由后传给唯一分支的原始阶段状态。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"schemaVersion":{"const":1},"phase":{"enum":["collect","execute"]},"payload":{"type":"object","additionalProperties":true}},"required":["schemaVersion","phase","payload"],"additionalProperties":false}
});

export const contract_13_7 = defineDataSchema({
  "type_key": "era.service.cycle.state",
  "representation": "json",
  "display_name": "服务收集或执行阶段的运行资料",
  "description": "保存服务当前处于事件收集还是批次执行阶段，以及该阶段需要的队列、任务和累计结果。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"schemaVersion":{"const":1},"phase":{"enum":["collect","execute"]},"payload":{"type":"object","additionalProperties":true}},"required":["schemaVersion","phase","payload"],"additionalProperties":false}
});

export const contract_13_8 = defineDataSchema({
  "type_key": "era.service.state.current",
  "representation": "json",
  "display_name": "ERA 当前服务状态",
  "description": "本次服务迭代读取的有界携带状态。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"schemaVersion":{"const":1},"collection":{"type":"array","maxItems":128,"items":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false}},"collectionBytes":{"type":"integer","minimum":0,"maximum":2097152},"iteration":{"type":"integer","minimum":0},"consecutiveProcessingCount":{"type":"integer","minimum":0},"consecutiveMk":{"oneOf":[{"type":"string","minLength":1},{"type":"null"}]},"timerToken":{"oneOf":[{"type":"string","minLength":1},{"type":"null"}]},"syncCursor":{"oneOf":[{"type":"null"},{"type":"object","properties":{"messageId":{"type":"integer","minimum":0},"mk":{"type":"string","minLength":1},"blockIndex":{"type":"integer","minimum":0}},"required":["messageId","mk","blockIndex"],"additionalProperties":false}]},"scopeWindow":{"type":"object","properties":{"token":{"oneOf":[{"type":"integer","minimum":1},{"type":"null"}]},"messageId":{"oneOf":[{"type":"integer","minimum":0},{"type":"null"}]},"messageAdmission":{"oneOf":[{"type":"boolean"},{"type":"null"}]},"branchAdmission":{"oneOf":[{"type":"boolean"},{"type":"null"}]}},"required":["token","messageId","messageAdmission","branchAdmission"],"additionalProperties":false}},"required":["schemaVersion","collection","collectionBytes","iteration","consecutiveProcessingCount","consecutiveMk","timerToken","scopeWindow"],"additionalProperties":false}
});

export const contract_13_9 = defineDataSchema({
  "type_key": "era.service.state.next",
  "representation": "json",
  "display_name": "ERA 下一服务状态",
  "description": "一次等待或批次处理后交还永久循环的有界状态。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"schemaVersion":{"const":1},"collection":{"type":"array","maxItems":128,"items":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false}},"collectionBytes":{"type":"integer","minimum":0,"maximum":2097152},"iteration":{"type":"integer","minimum":0},"consecutiveProcessingCount":{"type":"integer","minimum":0},"consecutiveMk":{"oneOf":[{"type":"string","minLength":1},{"type":"null"}]},"timerToken":{"oneOf":[{"type":"string","minLength":1},{"type":"null"}]},"syncCursor":{"oneOf":[{"type":"null"},{"type":"object","properties":{"messageId":{"type":"integer","minimum":0},"mk":{"type":"string","minLength":1},"blockIndex":{"type":"integer","minimum":0}},"required":["messageId","mk","blockIndex"],"additionalProperties":false}]},"scopeWindow":{"type":"object","properties":{"token":{"oneOf":[{"type":"integer","minimum":1},{"type":"null"}]},"messageId":{"oneOf":[{"type":"integer","minimum":0},{"type":"null"}]},"messageAdmission":{"oneOf":[{"type":"boolean"},{"type":"null"}]},"branchAdmission":{"oneOf":[{"type":"boolean"},{"type":"null"}]}},"required":["token","messageId","messageAdmission","branchAdmission"],"additionalProperties":false}},"required":["schemaVersion","collection","collectionBytes","iteration","consecutiveProcessingCount","consecutiveMk","timerToken","scopeWindow"],"additionalProperties":false}
});

export const contract_13_10 = defineDataSchema({
  "type_key": "era.service.state.post_batch",
  "representation": "json",
  "display_name": "ERA 批次后服务状态",
  "description": "批次收尾并发布出站帧后的有界服务状态。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"schemaVersion":{"const":1},"collection":{"type":"array","maxItems":128,"items":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false}},"collectionBytes":{"type":"integer","minimum":0,"maximum":2097152},"iteration":{"type":"integer","minimum":0},"consecutiveProcessingCount":{"type":"integer","minimum":0},"consecutiveMk":{"oneOf":[{"type":"string","minLength":1},{"type":"null"}]},"timerToken":{"oneOf":[{"type":"string","minLength":1},{"type":"null"}]},"syncCursor":{"oneOf":[{"type":"null"},{"type":"object","properties":{"messageId":{"type":"integer","minimum":0},"mk":{"type":"string","minLength":1},"blockIndex":{"type":"integer","minimum":0}},"required":["messageId","mk","blockIndex"],"additionalProperties":false}]},"scopeWindow":{"type":"object","properties":{"token":{"oneOf":[{"type":"integer","minimum":1},{"type":"null"}]},"messageId":{"oneOf":[{"type":"integer","minimum":0},{"type":"null"}]},"messageAdmission":{"oneOf":[{"type":"boolean"},{"type":"null"}]},"branchAdmission":{"oneOf":[{"type":"boolean"},{"type":"null"}]}},"required":["token","messageId","messageAdmission","branchAdmission"],"additionalProperties":false}},"required":["schemaVersion","collection","collectionBytes","iteration","consecutiveProcessingCount","consecutiveMk","timerToken","scopeWindow"],"additionalProperties":false}
});

export const contract_13_11 = defineDataSchema({
  "type_key": "era.service.state",
  "representation": "json",
  "display_name": "ERA 服务状态",
  "description": "永久服务循环携带的有界事件集、定时器与连续 MK 计数状态。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"schemaVersion":{"const":1},"collection":{"type":"array","maxItems":128,"items":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false}},"collectionBytes":{"type":"integer","minimum":0,"maximum":2097152},"iteration":{"type":"integer","minimum":0},"consecutiveProcessingCount":{"type":"integer","minimum":0},"consecutiveMk":{"oneOf":[{"type":"string","minLength":1},{"type":"null"}]},"timerToken":{"oneOf":[{"type":"string","minLength":1},{"type":"null"}]},"syncCursor":{"oneOf":[{"type":"null"},{"type":"object","properties":{"messageId":{"type":"integer","minimum":0},"mk":{"type":"string","minLength":1},"blockIndex":{"type":"integer","minimum":0}},"required":["messageId","mk","blockIndex"],"additionalProperties":false}]},"scopeWindow":{"type":"object","properties":{"token":{"oneOf":[{"type":"integer","minimum":1},{"type":"null"}]},"messageId":{"oneOf":[{"type":"integer","minimum":0},{"type":"null"}]},"messageAdmission":{"oneOf":[{"type":"boolean"},{"type":"null"}]},"branchAdmission":{"oneOf":[{"type":"boolean"},{"type":"null"}]}},"required":["token","messageId","messageAdmission","branchAdmission"],"additionalProperties":false}},"required":["schemaVersion","collection","collectionBytes","iteration","consecutiveProcessingCount","consecutiveMk","timerToken","scopeWindow"],"additionalProperties":false}
});

export const contract_13_12 = defineDataSchema({
  "type_key": "era.sidecar.binding.facts",
  "representation": "json",
  "display_name": "独立状态文件 绑定事实",
  "description": "当前身份、聊天 SidecarId、V2 文件记录与仅用于一次迁移的旧状态事实。运行资格由安装作用域 workflow 决定，缺失指针为 create 或 migrate-legacy。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["status","reason","current","sidecarId","record","legacyRecord","legacyState"],"additionalProperties":false,"properties":{"status":{"type":"string","enum":["create","migrate-legacy","matched","conflict","invalid","blocked"]},"reason":{"type":"string"},"current":{"type":["object","null"]},"sidecarId":{"type":["string","null"]},"record":{"type":["object","null"]},"legacyRecord":{"type":["object","null"]},"legacyState":{"type":["object","null"]}}}
});

export const contract_13_13 = defineDataSchema({
  "type_key": "era.sidecar.binding.input",
  "representation": "json",
  "display_name": "独立状态文件 绑定输入",
  "description": "保存状态文件绑定流程所需的聊天身份、文件资料及同步上下文。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["sync"],"additionalProperties":false,"properties":{"sync":{"type":"object"}}}
});

export const contract_13_14 = defineDataSchema({
  "type_key": "era.sidecar.binding.resolution",
  "representation": "json",
  "display_name": "独立状态文件 绑定决议",
  "description": "纯规则解析出的事实、路由与可选用户选择。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["facts","route","choice"],"additionalProperties":false,"properties":{"facts":{"type":"object"},"route":{"type":"string","enum":["continue","blocked","apply"]},"choice":{"type":["string","null"],"enum":["migrate","independent","copy","repair",null]}}}
});

export const contract_13_15 = defineDataSchema({
  "type_key": "era.sidecar.binding.route",
  "representation": "json",
  "display_name": "独立状态文件 绑定路由",
  "description": "Sidecar 绑定事务的正式条件路由。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string","enum":["continue","blocked","applied"]}
});

export const contract_13_16 = defineDataSchema({
  "type_key": "era.step.done",
  "representation": "json",
  "display_name": "ERA·步骤·完成",
  "description": "定义“ERA·步骤·完成”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"boolean"}
});
