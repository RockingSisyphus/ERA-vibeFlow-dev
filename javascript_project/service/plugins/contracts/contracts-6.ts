import {defineDataSchema} from "@vibeflow/plugin";

export const contract_5_0 = defineDataSchema({
  "type_key": "era.tavern.identity.read.result",
  "representation": "json",
  "display_name": "ERA·酒馆·身份·读取·结果",
  "description": "定义“ERA·酒馆·身份·读取·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_5_1 = defineDataSchema({
  "type_key": "era.tavern.installation_scope.read.request",
  "representation": "json",
  "display_name": "安装作用域读取请求",
  "description": "无输入的启动期脚本树读取请求。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false}
});

export const contract_5_2 = defineDataSchema({
  "type_key": "era.tavern.messages.read_context.outcome",
  "representation": "json",
  "display_name": "ERA 消息读取结果封装",
  "description": "在严格 Capability 投影外层记录成功值或带类型读取失败，供领域任务普通失败结算。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","oneOf":[{"type":"object","additionalProperties":false,"required":["ok","value"],"properties":{"ok":{"const":true},"value":{"type":"object","additionalProperties":false,"required":["schemaVersion","messages"],"properties":{"schemaVersion":{"const":2},"messages":{"type":"array"}}}}},{"type":"object","additionalProperties":false,"required":["ok","error"],"properties":{"ok":{"const":false},"error":{"type":"object","additionalProperties":false,"required":["code","message"],"properties":{"code":{"type":"string","minLength":1},"message":{"type":"string"}}}}}]}
});

export const contract_5_3 = defineDataSchema({
  "type_key": "era.tavern.messages.read_context.request",
  "representation": "json",
  "display_name": "ERA·酒馆·消息·读取·上下文·请求",
  "description": "定义“ERA·酒馆·消息·读取·上下文·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false,"required":["projection","range"],"properties":{"projection":{"const":"era-active-message-v1"},"range":{"oneOf":[{"type":"string","minLength":1},{"type":"integer"}]},"purpose":{"type":"string","minLength":1}}}
});

export const contract_5_4 = defineDataSchema({
  "type_key": "era.tavern.messages.read_context.result",
  "representation": "json",
  "display_name": "ERA·酒馆·消息·读取·上下文·结果",
  "description": "定义“ERA·酒馆·消息·读取·上下文·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false,"required":["schemaVersion","messages"],"properties":{"schemaVersion":{"const":2},"messages":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["schemaVersion","messageId","role","activeText","swipeIndex"],"properties":{"schemaVersion":{"const":1},"messageId":{"type":"integer","minimum":0},"role":{"type":"string","minLength":1},"activeText":{"type":"string"},"swipeIndex":{"oneOf":[{"type":"integer","minimum":0},{"type":"null"}]}}}}}}
});

export const contract_5_5 = defineDataSchema({
  "type_key": "era.tavern.messages.refresh.request",
  "representation": "json",
  "display_name": "ERA·酒馆·消息·刷新·请求",
  "description": "定义“ERA·酒馆·消息·刷新·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_5_6 = defineDataSchema({
  "type_key": "era.tavern.messages.refresh.result",
  "representation": "json",
  "display_name": "ERA·酒馆·消息·刷新·结果",
  "description": "定义“ERA·酒馆·消息·刷新·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_5_7 = defineDataSchema({
  "type_key": "era.tavern.messages.update_content.request",
  "representation": "json",
  "display_name": "ERA·酒馆·消息·更新·内容·请求",
  "description": "定义“ERA·酒馆·消息·更新·内容·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true,"properties":{"expectedSidecarId":{"type":["string","null"]}}}
});

export const contract_5_8 = defineDataSchema({
  "type_key": "era.tavern.messages.update_content.result",
  "representation": "json",
  "display_name": "ERA·酒馆·消息·更新·内容·结果",
  "description": "定义“ERA·酒馆·消息·更新·内容·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_5_9 = defineDataSchema({
  "type_key": "era.tavern.regex.read.request",
  "representation": "json",
  "display_name": "ERA·酒馆·正则·读取·请求",
  "description": "定义“ERA·酒馆·正则·读取·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_5_10 = defineDataSchema({
  "type_key": "era.tavern.regex.read.result",
  "representation": "json",
  "display_name": "ERA·酒馆·正则·读取·结果",
  "description": "定义“ERA·酒馆·正则·读取·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_5_11 = defineDataSchema({
  "type_key": "era.tavern.regex.upsert.request",
  "representation": "json",
  "display_name": "ERA·酒馆·正则·幂等写入·请求",
  "description": "定义“ERA·酒馆·正则·幂等写入·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_5_12 = defineDataSchema({
  "type_key": "era.tavern.regex.upsert.result",
  "representation": "json",
  "display_name": "ERA·酒馆·正则·幂等写入·结果",
  "description": "定义“ERA·酒馆·正则·幂等写入·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_5_13 = defineDataSchema({
  "type_key": "era.tavern.sidecar.clear_prompt.request",
  "representation": "json",
  "display_name": "独立状态文件 弹窗清理请求",
  "description": "清理当前 Sidecar 弹窗。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false,"properties":{"expectedSidecarId":{"type":["string","null"]},"sourceBasis":{"type":"object","additionalProperties":false,"required":["identity","messages"],"properties":{"identity":{"type":"object","additionalProperties":false,"required":["characterId","chatId","groupId"],"properties":{"characterId":{"type":["string","null"]},"chatId":{"type":"string"},"groupId":{"type":["string","null"]}}},"messages":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["schemaVersion","messageId","role","activeText","swipeIndex"],"properties":{"schemaVersion":{"const":1},"messageId":{"type":"integer","minimum":0},"role":{"type":"string","minLength":1},"activeText":{"type":"string"},"swipeIndex":{"oneOf":[{"type":"integer","minimum":0},{"type":"null"}]}}}}}}}}
});

export const contract_5_14 = defineDataSchema({
  "type_key": "era.tavern.sidecar.clear_prompt.result",
  "representation": "json",
  "display_name": "独立状态文件 弹窗清理结果",
  "description": "弹窗清理结论。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_5_15 = defineDataSchema({
  "type_key": "era.tavern.sidecar.commit_metadata.request",
  "representation": "json",
  "display_name": "独立状态文件 指针提交请求",
  "description": "只提交 ERAMetaData.SidecarId；可在已确认文件提交后携带易失快照。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["sidecarId"],"properties":{"sidecarId":{"type":"string"},"notifySubscribers":{"type":"boolean","description":"false 仅更新已保存块的即时读取缓存；消息完成时通知订阅者，默认 true。"},"snapshot":{"type":"object"},"workingVersion":{"type":"integer","minimum":0,"description":"本次保存对应的内存版本；版本已推进时不得用旧保存结果覆盖读取快照。"},"sourceBasis":{"type":"object","additionalProperties":false,"required":["identity","messages"],"properties":{"identity":{"type":"object","additionalProperties":false,"required":["characterId","chatId","groupId"],"properties":{"characterId":{"type":["string","null"]},"chatId":{"type":"string"},"groupId":{"type":["string","null"]}}},"messages":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["schemaVersion","messageId","role","activeText","swipeIndex"],"properties":{"schemaVersion":{"const":1},"messageId":{"type":"integer","minimum":0},"role":{"type":"string","minLength":1},"activeText":{"type":"string"},"swipeIndex":{"oneOf":[{"type":"integer","minimum":0},{"type":"null"}]}}}}}},"expectedSidecarId":{"type":["string","null"]}},"additionalProperties":false}
});

export const contract_5_16 = defineDataSchema({
  "type_key": "era.tavern.sidecar.commit_metadata.result",
  "representation": "json",
  "display_name": "独立状态文件 元数据提交结果",
  "description": "聊天元数据提交后的回读。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_5_17 = defineDataSchema({
  "type_key": "era.tavern.sidecar.create_id.request",
  "representation": "json",
  "display_name": "独立状态文件 ID 创建请求",
  "description": "创建稳定随机 SidecarId。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false}
});

export const contract_5_18 = defineDataSchema({
  "type_key": "era.tavern.sidecar.create_id.result",
  "representation": "json",
  "display_name": "独立状态文件 ID 创建结果",
  "description": "新建的稳定 SidecarId。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["sidecarId"],"properties":{"sidecarId":{"type":"string"}},"additionalProperties":false}
});

export const contract_5_19 = defineDataSchema({
  "type_key": "era.tavern.sidecar.present_prompt.request",
  "representation": "json",
  "display_name": "独立状态文件 弹窗请求",
  "description": "显示 workflow 已确定的不可关闭选择弹窗。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["prompt"],"properties":{"prompt":{"type":"object"}},"additionalProperties":false}
});
