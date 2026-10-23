import {defineDataSchema} from "@vibeflow/plugin";

export const contract_11_0 = defineDataSchema({
  "type_key": "era.command.operation.done",
  "representation": "json",
  "display_name": "当前操作范围是否全部结束",
  "description": "控制第四层操作循环退出；单字段或单函数完成不会提前结束整个块。",
  "schema": {"type":"boolean"}
});

export const contract_11_1 = defineDataSchema({
  "type_key": "era.command.operation.result",
  "representation": "json",
  "display_name": "本段指令的变量、函数、日志和诊断结果",
  "description": "保存一段指令处理完的变量、函数、历史记录、诊断和随机进度，供消息正文或生成阶段整理结果。",
  "schema": {"type":"object","properties":{"mode":{"type":"string","enum":["command","stage-calls"]},"commands":{"type":"array"},"commandIndex":{"type":"integer"},"rootIndex":{"type":"integer"},"stack":{"type":"array"},"stat":{},"statFunc":{"type":"object"},"messageStartStat":{},"messageStartStatFunc":{"type":"object"},"randomCursor":{"type":["object","null"]},"functionGroup":{"type":["object","null"]},"stageCallTable":{"type":["object","null"]},"editLog":{"type":"array"},"functionEditLog":{"type":"array"},"diagnostics":{"type":"array"},"done":{"type":"boolean"},"failure":{"type":["object","null"]},"context":{"type":"object"},"pendingAction":{"type":["object","null"]}},"required":["mode","stack","stat","statFunc","editLog","functionEditLog","diagnostics","done","context"],"additionalProperties":false}
});

export const contract_11_2 = defineDataSchema({
  "type_key": "era.command.operation.route",
  "representation": "json",
  "display_name": "下一项操作的处理方式",
  "description": "记录下一项应处理的变量、函数或阶段计算类型，或标明整段操作结束。",
  "schema": {"type":"string","enum":["insert","edit","delete","function-group","function-insert","function-edit","function-delete","function-validate","stage-call","skip","done","function-meta-complete"]}
});

export const contract_11_3 = defineDataSchema({
  "type_key": "era.command.operation.state.next",
  "representation": "json",
  "display_name": "下一轮有序操作状态",
  "description": "保存本项操作后的变量、函数、待处理列表和日志，作为下一项操作的输入。",
  "schema": {"type":"object","properties":{"mode":{"type":"string","enum":["command","stage-calls"]},"commands":{"type":"array"},"commandIndex":{"type":"integer"},"rootIndex":{"type":"integer"},"stack":{"type":"array"},"stat":{},"statFunc":{"type":"object"},"messageStartStat":{},"messageStartStatFunc":{"type":"object"},"randomCursor":{"type":["object","null"]},"functionGroup":{"type":["object","null"]},"stageCallTable":{"type":["object","null"]},"editLog":{"type":"array"},"functionEditLog":{"type":"array"},"diagnostics":{"type":"array"},"done":{"type":"boolean"},"failure":{"type":["object","null"]},"context":{"type":"object"},"pendingAction":{"type":["object","null"]}},"required":["mode","stack","stat","statFunc","editLog","functionEditLog","diagnostics","done","context"],"additionalProperties":false}
});

export const contract_11_4 = defineDataSchema({
  "type_key": "era.command.operation.state",
  "representation": "json",
  "display_name": "有序操作工作状态",
  "description": "保存当前指令的待处理字段、当前变量和函数、消息开始前的历史起点、随机使用次数及累计日志，供有序操作继续执行。",
  "schema": {"type":"object","properties":{"mode":{"type":"string","enum":["command","stage-calls"]},"commands":{"type":"array"},"commandIndex":{"type":"integer"},"rootIndex":{"type":"integer"},"stack":{"type":"array"},"stat":{},"statFunc":{"type":"object"},"messageStartStat":{},"messageStartStatFunc":{"type":"object"},"randomCursor":{"type":["object","null"]},"functionGroup":{"type":["object","null"]},"stageCallTable":{"type":["object","null"]},"editLog":{"type":"array"},"functionEditLog":{"type":"array"},"diagnostics":{"type":"array"},"done":{"type":"boolean"},"failure":{"type":["object","null"]},"context":{"type":"object"},"pendingAction":{"type":["object","null"]}},"required":["mode","stack","stat","statFunc","editLog","functionEditLog","diagnostics","done","context"],"additionalProperties":false}
});

export const contract_11_5 = defineDataSchema({
  "type_key": "era.crud.applied",
  "representation": "json",
  "display_name": "ERA·变量增删改·已应用",
  "description": "定义“ERA·CRUD·已应用”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_11_6 = defineDataSchema({
  "type_key": "era.crud.delta",
  "representation": "json",
  "display_name": "ERA·变量增删改·变更量",
  "description": "定义“ERA·CRUD·变更量”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_11_7 = defineDataSchema({
  "type_key": "era.crud.directives",
  "representation": "json",
  "display_name": "ERA·变量增删改·指令",
  "description": "定义“ERA·CRUD·指令”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_11_8 = defineDataSchema({
  "type_key": "era.crud.logged",
  "representation": "json",
  "display_name": "ERA·变量增删改·已记录",
  "description": "定义“ERA·CRUD·已记录”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_11_9 = defineDataSchema({
  "type_key": "era.crud.operation",
  "representation": "json",
  "display_name": "ERA·变量增删改·操作",
  "description": "定义“ERA·CRUD·操作”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_11_10 = defineDataSchema({
  "type_key": "era.crud.route",
  "representation": "json",
  "display_name": "ERA·变量增删改·路由",
  "description": "定义“ERA·CRUD·路由”的数据结构与校验约束。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string","enum":["insert","update","delete"]}
});

export const contract_11_11 = defineDataSchema({
  "type_key": "era.dispatch.canonical_context",
  "representation": "json",
  "display_name": "ERA 派发读取上下文",
  "description": "保存当前聊天和消息的已读取资料，包括身份、正文、所选回复、元数据及占位设置，供任务准备。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_11_12 = defineDataSchema({
  "type_key": "era.dispatch.context.route",
  "representation": "json",
  "display_name": "ERA 上下文准备路由",
  "description": "选择不读宿主或读取严格消息上下文。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","enum":["none","read"]}
});

export const contract_11_13 = defineDataSchema({
  "type_key": "era.dispatch.precommit.route",
  "representation": "json",
  "display_name": "ERA 预提交路由",
  "description": "选择提交或保留统一准备结果。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","enum":["commit","no-op"]}
});

export const contract_11_14 = defineDataSchema({
  "type_key": "era.dispatch.preparation.outcome",
  "representation": "json",
  "display_name": "ERA 派发准备结果",
  "description": "携带准备状态、严格消息、MK 与宿主写入确认。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_11_15 = defineDataSchema({
  "type_key": "era.dispatch.preparation.plan",
  "representation": "json",
  "display_name": "ERA 派发准备计划",
  "description": "声明消息和元数据的幂等预提交计划。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_11_16 = defineDataSchema({
  "type_key": "era.dispatch.seed",
  "representation": "json",
  "display_name": "ERA 派发准备种子",
  "description": "携带规划步骤、批次状态、显式任务来源和上下文要求。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_11_17 = defineDataSchema({
  "type_key": "era.expression.command.request",
  "representation": "json",
  "display_name": "ERA·表达式·命令·请求",
  "description": "Service 交给独立表达式 root 的纯命令 DTO：逐消息层起始 statData/statFunc 快照、原文位置有序的六类 ERA 标签、当前同步范围与既有重放身份。它不包含 Tavern 对象、Capability 或文件句柄。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_11_18 = defineDataSchema({
  "type_key": "era.expression.command.result",
  "representation": "json",
  "display_name": "ERA·表达式·命令·结果",
  "description": "独立表达式 root 返回的纯结果：顺序执行后的 statData/statFunc、变量与函数编辑日志、定位诊断，以及经同起始双快照重放验证的已封存楼层压缩候选。它尚未形成 Tavern 提交请求。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_11_19 = defineDataSchema({
  "type_key": "era.expression.random.cursor.report",
  "representation": "json",
  "display_name": "ERA·表达式·消息随机处理位置报告",
  "description": "记录本条消息重新执行时使用的随机次数，供计算流程核对随机进度。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["randomDrawsConsumed","nextRandomDrawOffset"],"properties":{"randomDrawsConsumed":{"type":"integer","minimum":0},"nextRandomDrawOffset":{"type":"integer","minimum":0}},"additionalProperties":false}
});
