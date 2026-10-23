import {defineDataSchema} from "@vibeflow/plugin";

export const contract_2_0 = defineDataSchema({
  "type_key": "era.api.commit.inspected",
  "representation": "json",
  "display_name": "即时 变量提交 窗口事实",
  "description": "当前身份、消息、目标与内存准入事实。",
  "schema": {"type":"object","additionalProperties":true}
});

export const contract_2_1 = defineDataSchema({
  "type_key": "era.api.commit.result",
  "representation": "json",
  "display_name": "即时 变量提交 分支结果",
  "description": "互斥的 committed、skipped 或 failed 结果。",
  "schema": {"type":"object","additionalProperties":true}
});

export const contract_2_2 = defineDataSchema({
  "type_key": "era.api.commit.target",
  "representation": "json",
  "display_name": "即时 变量提交 目标",
  "description": "写入前重新读取的最新 AI 消息目标。",
  "schema": {"type":"object","additionalProperties":true}
});

export const contract_2_3 = defineDataSchema({
  "type_key": "era.api.commit.transaction",
  "representation": "json",
  "display_name": "单次 ERA 命令文本",
  "description": "本次调用独立生成的单 scope 事务。",
  "schema": {"type":"object","additionalProperties":true}
});

export const contract_2_4 = defineDataSchema({
  "type_key": "era.api.commit.validated",
  "representation": "json",
  "display_name": "已校验即时 变量提交",
  "description": "携带 scope 与有序操作的已准入或 skipped 上下文。",
  "schema": {"type":"object","additionalProperties":true}
});

export const contract_2_5 = defineDataSchema({
  "type_key": "era.api.facade.result",
  "representation": "json",
  "display_name": "公共 公共接口 任务结果",
  "description": "commit 或 sync 的唯一互斥结果。",
  "schema": {"type":"object","additionalProperties":true}
});

export const contract_2_6 = defineDataSchema({
  "type_key": "era.api.request",
  "representation": "json",
  "display_name": "ERA 公共对象请求",
  "description": "保存提交或同步命令、原事件来源和已准备聊天资料，供公共接口任务执行。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["task","sources"],"properties":{"task":{"type":"object"},"sources":{"type":"array","minItems":1,"maxItems":128,"items":{"type":"object"}},"dispatchContext":{},"detail":{"type":"object"}},"additionalProperties":false}
});

export const contract_2_7 = defineDataSchema({
  "type_key": "era.api.route",
  "representation": "json",
  "display_name": "ERA 公共对象路由",
  "description": "内部 Facade 的 commit、sync 或失败路由。",
  "schema": {"type":"string","enum":["commit","sync","failed"]}
});

export const contract_2_8 = defineDataSchema({
  "type_key": "era.api.sync.context",
  "representation": "json",
  "display_name": "公共对象同步上下文",
  "description": "同步步骤或输入失败上下文。",
  "schema": {"type":"object","additionalProperties":true}
});

export const contract_2_9 = defineDataSchema({
  "type_key": "era.api.sync.result",
  "representation": "json",
  "display_name": "公共对象同步分支结果",
  "description": "互斥的同步成功或输入失败结果。",
  "schema": {"type":"object","additionalProperties":true}
});

export const contract_2_10 = defineDataSchema({
  "type_key": "era.api.sync.route",
  "representation": "json",
  "display_name": "公共对象同步路由",
  "description": "选择 sync 或 failed。",
  "schema": {"type":"string","enum":["sync","failed"]}
});

export const contract_2_11 = defineDataSchema({
  "type_key": "era.api.task.result",
  "representation": "json",
  "display_name": "ERA 公共对象任务结果",
  "description": "保存公共接口任务的执行状态、返回值、回执和诊断，供原请求结算。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"status":{"type":"string","enum":["committed","no-op","failed","fatal"]},"settlements":{"type":"array","maxItems":128,"items":{"oneOf":[{"type":"object","properties":{"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"status":{"const":"completed"},"taskId":{"type":"string","minLength":1},"relation":{"type":"string","enum":["primary","combined","coalesced"]},"value":{}},"required":["eventId","sequence","status","taskId","relation"],"additionalProperties":false},{"type":"object","properties":{"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"status":{"const":"ignored"},"reason":{"type":"string","minLength":1}},"required":["eventId","sequence","status","reason"],"additionalProperties":false},{"type":"object","properties":{"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"status":{"const":"failed"},"error":{"type":"object","properties":{"code":{"type":"string","minLength":1},"message":{"type":"string"},"category":{"type":"string","enum":["input","domain","tavern","cancelled"]},"retryable":{"type":"boolean"},"details":{"type":"object","additionalProperties":true}},"required":["code","message","category","retryable"],"additionalProperties":false}},"required":["eventId","sequence","status","error"],"additionalProperties":false},{"type":"object","properties":{"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"status":{"const":"cancelled"},"reason":{"type":"string","minLength":1}},"required":["eventId","sequence","status","reason"],"additionalProperties":false}]}},"notifications":{"type":"array","items":{"type":"object","properties":{"type":{"type":"string","minLength":1},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}}},"required":["type","args"],"additionalProperties":false}},"diagnostics":{"type":"array","items":{"type":"object","properties":{"code":{"type":"string","minLength":1},"message":{"type":"string"},"sequence":{"oneOf":[{"type":"integer","minimum":1},{"type":"null"}]}},"required":["code","message","sequence"],"additionalProperties":false}},"stateUpdate":{"type":"object","properties":{"consecutiveMk":{"oneOf":[{"type":"string","minLength":1},{"type":"null"}]},"consecutiveProcessingCount":{"type":"integer","minimum":0},"syncCursor":{"oneOf":[{"type":"null"},{"type":"object","properties":{"messageId":{"type":"integer","minimum":0},"mk":{"type":"string","minLength":1},"blockIndex":{"type":"integer","minimum":0}},"required":["messageId","mk","blockIndex"],"additionalProperties":false}]},"scopeWindow":{"type":"object","properties":{"token":{"oneOf":[{"type":"integer","minimum":1},{"type":"null"}]},"messageId":{"oneOf":[{"type":"integer","minimum":0},{"type":"null"}]},"messageAdmission":{"oneOf":[{"type":"boolean"},{"type":"null"}]},"branchAdmission":{"oneOf":[{"type":"boolean"},{"type":"null"}]}},"required":["token","messageId","messageAdmission","branchAdmission"],"additionalProperties":false}},"required":["consecutiveMk","consecutiveProcessingCount"],"additionalProperties":false}},"required":["status","settlements","notifications","diagnostics"],"additionalProperties":false}
});

export const contract_2_12 = defineDataSchema({
  "type_key": "era.api.window.recheck.route",
  "representation": "json",
  "display_name": "窗口复核路由",
  "description": "选择 current 或 changed。",
  "schema": {"type":"string","enum":["current","changed"]}
});

export const contract_2_13 = defineDataSchema({
  "type_key": "era.batch.coverage.route",
  "representation": "json",
  "display_name": "ERA·批次·覆盖·路由",
  "description": "定义“ERA·批次·覆盖·路由”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string","enum":["execute","invalid"]}
});

export const contract_2_14 = defineDataSchema({
  "type_key": "era.step.request",
  "representation": "json",
  "display_name": "ERA 步骤请求",
  "description": "按批次索引选择的一个有界动态步骤。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","oneOf":[{"type":"object","properties":{"kind":{"const":"execute"},"stepId":{"type":"string","minLength":1},"index":{"type":"integer","minimum":0,"maximum":127},"sourceSequences":{"type":"array","minItems":1,"maxItems":128,"items":{"type":"integer","minimum":1}},"events":{"type":"array","minItems":1,"maxItems":128,"items":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false}},"taskRoute":{"type":"string","enum":["initialize","sync","api","update-mk","agent-generation-session"]},"task":{"oneOf":[{"type":"object","properties":{"id":{"type":"string","minLength":1},"sourceEvents":{"type":"array","minItems":1,"maxItems":128,"items":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false}},"primaryEvent":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false},"context":{"type":"string","enum":["none","latest-message","latest-message-with-mk"]},"kind":{"const":"initialize"},"operation":{"type":"string","enum":["startup","resources","settings-update"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}}},"required":["id","sourceEvents","primaryEvent","context","kind","operation","args"],"additionalProperties":false},{"type":"object","properties":{"id":{"type":"string","minLength":1},"sourceEvents":{"type":"array","minItems":1,"maxItems":128,"items":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false}},"primaryEvent":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false},"context":{"type":"string","enum":["none","latest-message","latest-message-with-mk"]},"kind":{"const":"sync"},"reason":{"type":"string","enum":["history-changed","edited","swipe-regeneration","manual","facade-commit"]},"target":{"oneOf":[{"type":"object","properties":{"kind":{"const":"auto"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"message"},"messageId":{"type":"integer","minimum":0},"stopAfterTarget":{"type":"boolean"}},"required":["kind","messageId","stopAfterTarget"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"previous-of-latest"},"stopAfterTarget":{"const":true}},"required":["kind","stopAfterTarget"],"additionalProperties":false}]},"fullRebuild":{"type":"boolean"}},"required":["id","sourceEvents","primaryEvent","context","kind","reason","target","fullRebuild"],"additionalProperties":false},{"type":"object","properties":{"id":{"type":"string","minLength":1},"sourceEvents":{"type":"array","minItems":1,"maxItems":128,"items":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false}},"primaryEvent":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false},"context":{"type":"string","enum":["none","latest-message","latest-message-with-mk"]},"kind":{"const":"api"},"intent":{"type":"string","enum":["query","message-write","state-sync"]},"eventType":{"type":"string","minLength":1},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}}},"required":["id","sourceEvents","primaryEvent","context","kind","intent","eventType","args"],"additionalProperties":false},{"type":"object","properties":{"id":{"type":"string","minLength":1},"sourceEvents":{"type":"array","minItems":1,"maxItems":128,"items":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false}},"primaryEvent":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false},"context":{"type":"string","enum":["none","latest-message","latest-message-with-mk"]},"kind":{"const":"update-mk"}},"required":["id","sourceEvents","primaryEvent","context","kind"],"additionalProperties":false}]},"sources":{"type":"array","minItems":1,"maxItems":128,"items":{"type":"object","properties":{"event":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false},"relation":{"type":"string","enum":["primary","combined","coalesced"]}},"required":["event","relation"],"additionalProperties":false}}},"required":["kind","stepId","index","taskRoute","sourceSequences","events","task","sources"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"ignore"},"stepId":{"type":"string","minLength":1},"index":{"type":"integer","minimum":0,"maximum":127},"sourceSequences":{"type":"array","minItems":1,"maxItems":128,"items":{"type":"integer","minimum":1}},"events":{"type":"array","minItems":1,"maxItems":128,"items":{"type":"object","allOf":[{"oneOf":[{"type":"object","properties":{"source":{"enum":["tavern","ui","era-api"]}},"required":["source"]},{"type":"object","properties":{"source":{"const":"timer"},"type":{"const":"era.service.collection_timer"}},"required":["source","type"]}]}],"properties":{"schemaVersion":{"const":1},"eventId":{"type":"string","minLength":1},"sequence":{"type":"integer","minimum":1},"type":{"type":"string","minLength":1},"occurredAt":{"type":"number"},"source":{"type":"string","enum":["tavern","ui","era-api","timer"]},"args":{"type":"array","items":{"oneOf":[{"type":"object","properties":{"kind":{"const":"json"},"value":{}},"required":["kind","value"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"undefined"}},"required":["kind"],"additionalProperties":false},{"type":"object","properties":{"kind":{"const":"host-ref"},"token":{"type":"string","minLength":1},"refKind":{"type":"string","minLength":1}},"required":["kind","token","refKind"],"additionalProperties":false}]}},"encodedBytes":{"type":"integer","minimum":0,"maximum":262144}},"required":["schemaVersion","eventId","sequence","type","occurredAt","source","args","encodedBytes"],"additionalProperties":false}},"taskRoute":{"const":"ignore"},"reason":{"type":"string","minLength":1}},"required":["kind","stepId","index","taskRoute","sourceSequences","events","reason"],"additionalProperties":false}]}
});

export const contract_2_15 = defineDataSchema({
  "type_key": "era.sync.author.call.route",
  "representation": "json",
  "display_name": "作者调用解析结论",
  "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。",
  "schema": {"type":"string","enum":["valid","invalid"]}
});

export const contract_2_16 = defineDataSchema({
  "type_key": "era.sync.author.event.action",
  "display_name": "作者函数接下来要处理的事件",
  "representation": "json",
  "schema": {"type":"string","enum":["commit","unsupported","done","failed","complete"]}
});

export const contract_2_17 = defineDataSchema({
  "type_key": "era.sync.author.lifecycle.route",
  "representation": "json",
  "display_name": "作者函数本次应启动、等待或收尾",
  "description": "记录正文作者函数本次应启动、确认提交、等待请求还是结束，供作者调用流程选择下一步。",
  "schema": {"type":"string","enum":["terminal","start","wait"]}
});

export const contract_2_18 = defineDataSchema({
  "type_key": "era.sync.author.state",
  "representation": "json",
  "display_name": "作者函数处理中的位置工作状态",
  "description": "作者函数启动、等待、请求分类和确认过程中的私有位置状态；与交回消息块循环的最终位置分开，只有本次处理结束时才交还。",
  "schema": {"type":"object","properties":{"state":{"type":"object"},"position":{"type":["object","null"]},"incomingFunctionEvent":{"type":["object","null"]},"failure":{"type":["object","null"]},"consumedSource":{"type":"boolean"},"diagnosticsBefore":{"type":"integer"}},"required":["state","consumedSource","diagnosticsBefore"],"additionalProperties":false}
});

export const contract_2_19 = defineDataSchema({
  "type_key": "era.sync.block.step.pending",
  "representation": "json",
  "display_name": "ERA·同步·块步进状态·待提交",
  "description": "保存处理结束后的消息修改、独立状态文件候选及原任务资料，供统一保存。",
  "schema": {"type":"object","properties":{"work":{"type":"object"},"done":{"type":"boolean"},"sourceBasis":{"type":["object","null"]},"apiContext":{"type":"object"},"functionFrame":{"type":["object","null"]},"scopeWindow":{"type":"object"},"stageOutcome":{"type":"object"}},"required":["work","done","sourceBasis"],"additionalProperties":false}
});
