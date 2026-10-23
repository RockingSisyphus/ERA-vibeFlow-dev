import {defineDataSchema} from "@vibeflow/plugin";

export const contract_6_0 = defineDataSchema({
  "type_key": "era.tavern.sidecar.present_prompt.result",
  "representation": "json",
  "display_name": "独立状态文件 弹窗结果",
  "description": "弹窗发布结论。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_1 = defineDataSchema({
  "type_key": "era.tavern.sidecar.read_current.request",
  "representation": "json",
  "display_name": "独立状态文件 当前上下文读取请求",
  "description": "读取当前角色、聊天和变量。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":false}
});

export const contract_6_2 = defineDataSchema({
  "type_key": "era.tavern.sidecar.read_current.result",
  "representation": "json",
  "display_name": "独立状态文件 当前上下文读取结果",
  "description": "当前身份、元数据和变量快照。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_3 = defineDataSchema({
  "type_key": "era.tavern.sidecar.read_record.request",
  "representation": "json",
  "display_name": "独立状态文件 记录读取请求",
  "description": "按稳定 SidecarId 读取当前用户 files 记录。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["sidecarId"],"properties":{"sidecarId":{"type":"string"}},"additionalProperties":false}
});

export const contract_6_4 = defineDataSchema({
  "type_key": "era.tavern.sidecar.read_record.result",
  "representation": "json",
  "display_name": "独立状态文件 记录读取结果",
  "description": "当前用户 files 中的受控记录。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_5 = defineDataSchema({
  "type_key": "era.tavern.sidecar.write_record.request",
  "representation": "json",
  "display_name": "独立状态文件 记录写入请求",
  "description": "写入版本化当前用户 files 记录。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["sidecarId","record"],"properties":{"sidecarId":{"type":"string"},"record":{"type":"object"},"sourceBasis":{"type":"object","additionalProperties":false,"required":["identity","messages"],"properties":{"identity":{"type":"object","additionalProperties":false,"required":["characterId","chatId","groupId"],"properties":{"characterId":{"type":["string","null"]},"chatId":{"type":"string"},"groupId":{"type":["string","null"]}}},"messages":{"type":"array","items":{"type":"object","additionalProperties":false,"required":["schemaVersion","messageId","role","activeText","swipeIndex"],"properties":{"schemaVersion":{"const":1},"messageId":{"type":"integer","minimum":0},"role":{"type":"string","minLength":1},"activeText":{"type":"string"},"swipeIndex":{"oneOf":[{"type":"integer","minimum":0},{"type":"null"}]}}}}}},"expectedSidecarId":{"type":["string","null"]}},"additionalProperties":false}
});

export const contract_6_6 = defineDataSchema({
  "type_key": "era.tavern.sidecar.write_record.result",
  "representation": "json",
  "display_name": "独立状态文件 记录写入结果",
  "description": "受控文件写入结论。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_7 = defineDataSchema({
  "type_key": "era.tavern.startup_gate.result",
  "representation": "json",
  "display_name": "是否启用本次页面服务",
  "description": "Host 对 workflow 启动决议的机械执行结果。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["activated"],"properties":{"activated":{"type":"boolean"}},"additionalProperties":false}
});

export const contract_6_8 = defineDataSchema({
  "type_key": "era.tavern.variables.commit.request",
  "representation": "json",
  "display_name": "ERA·酒馆·变量·提交·请求",
  "description": "定义“ERA·酒馆·变量·提交·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_9 = defineDataSchema({
  "type_key": "era.tavern.variables.commit.result",
  "representation": "json",
  "display_name": "ERA·酒馆·变量·提交·结果",
  "description": "定义“ERA·酒馆·变量·提交·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_10 = defineDataSchema({
  "type_key": "era.tavern.variables.read.request",
  "representation": "json",
  "display_name": "ERA·酒馆·变量·读取·请求",
  "description": "定义“ERA·酒馆·变量·读取·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_11 = defineDataSchema({
  "type_key": "era.tavern.variables.read.result",
  "representation": "json",
  "display_name": "ERA·酒馆·变量·读取·结果",
  "description": "定义“ERA·酒馆·变量·读取·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_12 = defineDataSchema({
  "type_key": "era.tavern.worldbook.bind.request",
  "representation": "json",
  "display_name": "ERA·酒馆·世界书·绑定·请求",
  "description": "定义“ERA·酒馆·世界书·绑定·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_13 = defineDataSchema({
  "type_key": "era.tavern.worldbook.bind.result",
  "representation": "json",
  "display_name": "ERA·酒馆·世界书·绑定·结果",
  "description": "定义“ERA·酒馆·世界书·绑定·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_14 = defineDataSchema({
  "type_key": "era.tavern.worldbook.create.request",
  "representation": "json",
  "display_name": "ERA·酒馆·世界书·创建·请求",
  "description": "定义“ERA·酒馆·世界书·创建·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_15 = defineDataSchema({
  "type_key": "era.tavern.worldbook.create.result",
  "representation": "json",
  "display_name": "ERA·酒馆·世界书·创建·结果",
  "description": "定义“ERA·酒馆·世界书·创建·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_16 = defineDataSchema({
  "type_key": "era.tavern.worldbook.read.request",
  "representation": "json",
  "display_name": "ERA·酒馆·世界书·读取·请求",
  "description": "定义“ERA·酒馆·世界书·读取·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_17 = defineDataSchema({
  "type_key": "era.tavern.worldbook.read.result",
  "representation": "json",
  "display_name": "ERA·酒馆·世界书·读取·结果",
  "description": "定义“ERA·酒馆·世界书·读取·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_18 = defineDataSchema({
  "type_key": "era.tavern.worldbook.replace_entries.request",
  "representation": "json",
  "display_name": "ERA·酒馆·世界书·替换·条目·请求",
  "description": "定义“ERA·酒馆·世界书·替换·条目·请求”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_6_19 = defineDataSchema({
  "type_key": "era.tavern.worldbook.replace_entries.result",
  "representation": "json",
  "display_name": "ERA·酒馆·世界书·替换·条目·结果",
  "description": "定义“ERA·酒馆·世界书·替换·条目·结果”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});
