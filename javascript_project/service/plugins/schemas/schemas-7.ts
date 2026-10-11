import {defineDataSchema} from "@vibeflow/plugin";

export const schema50 = defineDataSchema({
  "type_key": "era.collection.reduction",
  "representation": "json",
  "display_name": "ERA 事件集归约结果",
  "description": "一次事件集归约产生的等待或执行路由、下一状态与待执行事件。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "schemaVersion": {"const": 1},
      "route": {"type": "string", "enum": ["wait", "execute"]},
      "nextState": {
        "type": "object",
        "properties": {
          "schemaVersion": {"const": 1},
          "collection": {
            "type": "array",
            "maxItems": 128,
            "items": {
              "type": "object",
              "allOf": [{"oneOf": [{"type": "object", "properties": {"source": {"enum": ["tavern", "ui", "era-api"]}}, "required": ["source"]}, {"type": "object", "properties": {"source": {"const": "timer"}, "type": {"const": "era.service.collection_timer"}}, "required": ["source", "type"]}]}],
              "properties": {
                "schemaVersion": {"const": 1},
                "eventId": {"type": "string", "minLength": 1},
                "sequence": {"type": "integer", "minimum": 1},
                "type": {"type": "string", "minLength": 1},
                "occurredAt": {"type": "number"},
                "source": {"type": "string", "enum": ["tavern", "ui", "era-api", "timer"]},
                "args": {"type": "array", "items": {"oneOf": [{"type": "object", "properties": {"kind": {"const": "json"}, "value": {}}, "required": ["kind", "value"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "undefined"}}, "required": ["kind"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "host-ref"}, "token": {"type": "string", "minLength": 1}, "refKind": {"type": "string", "minLength": 1}}, "required": ["kind", "token", "refKind"], "additionalProperties": false}]}},
                "encodedBytes": {"type": "integer", "minimum": 0, "maximum": 262144}
              },
              "required": ["schemaVersion", "eventId", "sequence", "type", "occurredAt", "source", "args", "encodedBytes"],
              "additionalProperties": false
            }
          },
          "collectionBytes": {"type": "integer", "minimum": 0, "maximum": 2097152},
          "iteration": {"type": "integer", "minimum": 0},
          "consecutiveProcessingCount": {"type": "integer", "minimum": 0},
          "consecutiveMk": {"oneOf": [{"type": "string", "minLength": 1}, {"type": "null"}]},
          "timerToken": {"oneOf": [{"type": "string", "minLength": 1}, {"type": "null"}]},
          "syncCursor": {"oneOf": [{"type": "null"}, {"type": "object", "properties": {"messageId": {"type": "integer", "minimum": 0}, "mk": {"type": "string", "minLength": 1}, "blockIndex": {"type": "integer", "minimum": 0}}, "required": ["messageId", "mk", "blockIndex"], "additionalProperties": false}]},
          "scopeWindow": {"type": "object", "properties": {"token": {"oneOf": [{"type": "integer", "minimum": 1}, {"type": "null"}]}, "messageId": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}, "messageAdmission": {"oneOf": [{"type": "boolean"}, {"type": "null"}]}, "branchAdmission": {"oneOf": [{"type": "boolean"}, {"type": "null"}]}}, "required": ["token", "messageId", "messageAdmission", "branchAdmission"], "additionalProperties": false}
        },
        "required": ["schemaVersion", "collection", "collectionBytes", "iteration", "consecutiveProcessingCount", "consecutiveMk", "timerToken", "scopeWindow"],
        "additionalProperties": false
      },
      "batchEvents": {
        "type": "array",
        "maxItems": 128,
        "items": {
          "type": "object",
          "allOf": [{"oneOf": [{"type": "object", "properties": {"source": {"enum": ["tavern", "ui", "era-api"]}}, "required": ["source"]}, {"type": "object", "properties": {"source": {"const": "timer"}, "type": {"const": "era.service.collection_timer"}}, "required": ["source", "type"]}]}],
          "properties": {
            "schemaVersion": {"const": 1},
            "eventId": {"type": "string", "minLength": 1},
            "sequence": {"type": "integer", "minimum": 1},
            "type": {"type": "string", "minLength": 1},
            "occurredAt": {"type": "number"},
            "source": {"type": "string", "enum": ["tavern", "ui", "era-api", "timer"]},
            "args": {"type": "array", "items": {"oneOf": [{"type": "object", "properties": {"kind": {"const": "json"}, "value": {}}, "required": ["kind", "value"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "undefined"}}, "required": ["kind"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "host-ref"}, "token": {"type": "string", "minLength": 1}, "refKind": {"type": "string", "minLength": 1}}, "required": ["kind", "token", "refKind"], "additionalProperties": false}]}},
            "encodedBytes": {"type": "integer", "minimum": 0, "maximum": 262144}
          },
          "required": ["schemaVersion", "eventId", "sequence", "type", "occurredAt", "source", "args", "encodedBytes"],
          "additionalProperties": false
        }
      },
      "throughSequence": {"oneOf": [{"type": "integer", "minimum": 1}, {"type": "null"}]}
    },
    "required": ["schemaVersion", "route", "nextState", "batchEvents", "throughSequence"],
    "additionalProperties": false
  }
});

export const schema51 = defineDataSchema({"type_key": "era.command_compaction.compacted", "representation": "json", "display_name": "安全压缩候选", "description": "包含纯压缩 root 输出候选的 Service 压缩上下文。", "schema": {"type": "object", "additionalProperties": true}});

export const schema52 = defineDataSchema({"type_key": "era.command_compaction.identified", "representation": "json", "display_name": "已识别封存楼层", "description": "已选择有效封存候选并清理孤儿 marker 的 Service 压缩上下文。", "schema": {"type": "object", "additionalProperties": true}});

export const schema53 = defineDataSchema({"type_key": "era.command_compaction.parsed", "representation": "json", "display_name": "已识别执行范围的变量提交", "description": "带原文 era_tx 顺序与 scope 摘要的压缩上下文。", "schema": {"type": "object", "additionalProperties": true}});

export const schema54 = defineDataSchema({"type_key": "era.command_compaction.partitioned", "representation": "json", "display_name": "已按允许执行范围划分的消息段", "description": "按正文和 scope 硬边界划分连续段的压缩上下文。", "schema": {"type": "object", "additionalProperties": true}});

export const schema55 = defineDataSchema({"type_key": "era.command_compaction.replayed", "representation": "json", "display_name": "Service 重放结果", "description": "包含真实 CRUD 重放及等价判定的 Service 压缩上下文。", "schema": {"type": "object", "additionalProperties": true}});

export const schema56 = defineDataSchema({"type_key": "era.command_compaction.result", "representation": "json", "display_name": "已验证封存压缩同步结果", "description": "表达式命令同步工作项经纯命令层压缩与 Service CRUD 复放确认后的结果。", "schema": {"type": "object", "additionalProperties": true}});

export const schema57 = defineDataSchema({"type_key": "era.command_compaction.written", "representation": "json", "display_name": "已回填压缩结果", "description": "已回填消息更新和变量函数日志、等待 marker 结算的上下文。", "schema": {"type": "object", "additionalProperties": true}});

export const schema58 = defineDataSchema({"type_key": "era.command.delete.route", "representation": "json", "display_name": "删除路径分支", "description": "记录删除检查后应删除当前项、深入子字段还是跳过，供保留规则处理。", "schema": {"type": "string", "enum": ["descend", "apply", "skip"]}});

export const schema59 = defineDataSchema({"type_key": "era.command.edit.route", "representation": "json", "display_name": "修改路径分支", "description": "记录变量修改检查后应赋值、计算公式、深入子字段还是跳过。", "schema": {"type": "string", "enum": ["descend", "assign", "expr", "skip"]}});

export const schema60 = defineDataSchema({"type_key": "era.command.expression.request", "representation": "json", "display_name": "带用途的 Expression 请求", "description": "保存待计算的变量公式、待检查的临时函数库或生成阶段函数调用，并携带当前操作进度，供表达式结果接回原操作。", "schema": {"type": "object", "properties": {"purpose": {"type": "string", "enum": ["value", "library", "stage-call"]}, "request": {"type": "object"}, "operationState": {"type": "object"}}, "required": ["purpose", "request", "operationState"], "additionalProperties": false}});

export const schema61 = defineDataSchema({"type_key": "era.command.expression.response", "representation": "json", "display_name": "带用途的 Expression 结果", "description": "保存表达式实际返回的数值或诊断、已使用随机次数及原请求用途，供判断下一步如何应用。", "schema": {"type": "object", "properties": {"purpose": {"type": "string", "enum": ["value", "library", "stage-call"]}, "response": {"type": "object"}, "operationState": {"type": "object"}}, "required": ["purpose", "response", "operationState"], "additionalProperties": false}});

export const schema62 = defineDataSchema({"type_key": "era.command.expression.route", "representation": "json", "display_name": "公式求值、函数库检查或阶段函数结果分支", "description": "记录表达式结果应进入变量赋值、函数库应用、阶段函数记录还是错误处理分支。", "schema": {"type": "string", "enum": ["value", "value-failed", "library", "library-failed", "stage-call", "stage-call-failed"]}});

export const schema63 = defineDataSchema({"type_key": "era.command.function.delete.route", "representation": "json", "display_name": "函数删除范围", "description": "整函数动作保留原保护；元数据路径删除复用有序操作栈，不把候选修改提前提交。", "schema": {"type": "string", "enum": ["whole", "meta"]}});

export const schema64 = defineDataSchema({"type_key": "era.command.function.group.route", "representation": "json", "display_name": "函数组准入", "description": "记录函数名称及格式检查后的分支：建立临时函数库或返回整组失败。", "schema": {"type": "string", "enum": ["valid", "invalid"]}});

export const schema65 = defineDataSchema({"type_key": "era.command.function.item.route", "representation": "json", "display_name": "函数项准备结论", "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。", "schema": {"type": "string", "enum": ["apply", "skip", "invalid"]}});

export const schema66 = defineDataSchema({"type_key": "era.command.insert.route", "representation": "json", "display_name": "新增路径分支", "description": "记录新增变量检查后应新增、深入子字段还是跳过，供字段处理流程选择下一步。", "schema": {"type": "string", "enum": ["descend", "apply", "skip"]}});

export const schema67 = defineDataSchema({"type_key": "era.command.operation.done", "representation": "json", "display_name": "当前操作范围是否全部结束", "description": "控制第四层操作循环退出；单字段或单函数完成不会提前结束整个块。", "schema": {"type": "boolean"}});

export const schema68 = defineDataSchema({
  "type_key": "era.command.operation.result",
  "representation": "json",
  "display_name": "本段指令的变量、函数、日志和诊断结果",
  "description": "保存一段指令处理完的变量、函数、历史记录、诊断和随机进度，供消息正文或生成阶段整理结果。",
  "schema": {
    "type": "object",
    "properties": {
      "mode": {"type": "string", "enum": ["command", "stage-calls"]},
      "commands": {"type": "array"},
      "commandIndex": {"type": "integer"},
      "rootIndex": {"type": "integer"},
      "stack": {"type": "array"},
      "stat": {},
      "statFunc": {"type": "object"},
      "messageStartStat": {},
      "messageStartStatFunc": {"type": "object"},
      "randomCursor": {"type": ["object", "null"]},
      "functionGroup": {"type": ["object", "null"]},
      "stageCallTable": {"type": ["object", "null"]},
      "editLog": {"type": "array"},
      "functionEditLog": {"type": "array"},
      "diagnostics": {"type": "array"},
      "done": {"type": "boolean"},
      "failure": {"type": ["object", "null"]},
      "context": {"type": "object"},
      "pendingAction": {"type": ["object", "null"]}
    },
    "required": ["mode", "stack", "stat", "statFunc", "editLog", "functionEditLog", "diagnostics", "done", "context"],
    "additionalProperties": false
  }
});

export const schema69 = defineDataSchema({"type_key": "era.command.operation.route", "representation": "json", "display_name": "下一项操作的处理方式", "description": "记录下一项应处理的变量、函数或阶段计算类型，或标明整段操作结束。", "schema": {"type": "string", "enum": ["insert", "edit", "delete", "function-group", "function-insert", "function-edit", "function-delete", "function-validate", "stage-call", "skip", "done", "function-meta-complete"]}});

export const schema70 = defineDataSchema({
  "type_key": "era.command.operation.state.next",
  "representation": "json",
  "display_name": "下一轮有序操作状态",
  "description": "保存本项操作后的变量、函数、待处理列表和日志，作为下一项操作的输入。",
  "schema": {
    "type": "object",
    "properties": {
      "mode": {"type": "string", "enum": ["command", "stage-calls"]},
      "commands": {"type": "array"},
      "commandIndex": {"type": "integer"},
      "rootIndex": {"type": "integer"},
      "stack": {"type": "array"},
      "stat": {},
      "statFunc": {"type": "object"},
      "messageStartStat": {},
      "messageStartStatFunc": {"type": "object"},
      "randomCursor": {"type": ["object", "null"]},
      "functionGroup": {"type": ["object", "null"]},
      "stageCallTable": {"type": ["object", "null"]},
      "editLog": {"type": "array"},
      "functionEditLog": {"type": "array"},
      "diagnostics": {"type": "array"},
      "done": {"type": "boolean"},
      "failure": {"type": ["object", "null"]},
      "context": {"type": "object"},
      "pendingAction": {"type": ["object", "null"]}
    },
    "required": ["mode", "stack", "stat", "statFunc", "editLog", "functionEditLog", "diagnostics", "done", "context"],
    "additionalProperties": false
  }
});

export const schema71 = defineDataSchema({
  "type_key": "era.command.operation.state",
  "representation": "json",
  "display_name": "有序操作工作状态",
  "description": "保存当前指令的待处理字段、当前变量和函数、消息开始前的历史起点、随机使用次数及累计日志，供有序操作继续执行。",
  "schema": {
    "type": "object",
    "properties": {
      "mode": {"type": "string", "enum": ["command", "stage-calls"]},
      "commands": {"type": "array"},
      "commandIndex": {"type": "integer"},
      "rootIndex": {"type": "integer"},
      "stack": {"type": "array"},
      "stat": {},
      "statFunc": {"type": "object"},
      "messageStartStat": {},
      "messageStartStatFunc": {"type": "object"},
      "randomCursor": {"type": ["object", "null"]},
      "functionGroup": {"type": ["object", "null"]},
      "stageCallTable": {"type": ["object", "null"]},
      "editLog": {"type": "array"},
      "functionEditLog": {"type": "array"},
      "diagnostics": {"type": "array"},
      "done": {"type": "boolean"},
      "failure": {"type": ["object", "null"]},
      "context": {"type": "object"},
      "pendingAction": {"type": ["object", "null"]}
    },
    "required": ["mode", "stack", "stat", "statFunc", "editLog", "functionEditLog", "diagnostics", "done", "context"],
    "additionalProperties": false
  }
});

export const schema72 = defineDataSchema({"type_key": "era.crud.applied", "representation": "json", "display_name": "ERA·变量增删改·已应用", "description": "定义“ERA·CRUD·已应用”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema73 = defineDataSchema({"type_key": "era.crud.delta", "representation": "json", "display_name": "ERA·变量增删改·变更量", "description": "定义“ERA·CRUD·变更量”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema74 = defineDataSchema({"type_key": "era.crud.directives", "representation": "json", "display_name": "ERA·变量增删改·指令", "description": "定义“ERA·CRUD·指令”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema75 = defineDataSchema({"type_key": "era.crud.logged", "representation": "json", "display_name": "ERA·变量增删改·已记录", "description": "定义“ERA·CRUD·已记录”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema76 = defineDataSchema({"type_key": "era.crud.operation", "representation": "json", "display_name": "ERA·变量增删改·操作", "description": "定义“ERA·CRUD·操作”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema77 = defineDataSchema({"type_key": "era.crud.route", "representation": "json", "display_name": "ERA·变量增删改·路由", "description": "定义“ERA·CRUD·路由”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["insert", "update", "delete"]}});

export const schema78 = defineDataSchema({"type_key": "era.dispatch.canonical_context", "representation": "json", "display_name": "ERA 派发读取上下文", "description": "保存当前聊天和消息的已读取资料，包括身份、正文、所选回复、元数据及占位设置，供任务准备。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema79 = defineDataSchema({"type_key": "era.dispatch.context.route", "representation": "json", "display_name": "ERA 上下文准备路由", "description": "选择不读宿主或读取严格消息上下文。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "enum": ["none", "read"]}});

export const schema80 = defineDataSchema({"type_key": "era.dispatch.precommit.route", "representation": "json", "display_name": "ERA 预提交路由", "description": "选择提交或保留统一准备结果。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "enum": ["commit", "no-op"]}});

export const schema81 = defineDataSchema({"type_key": "era.dispatch.preparation.outcome", "representation": "json", "display_name": "ERA 派发准备结果", "description": "携带准备状态、严格消息、MK 与宿主写入确认。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema82 = defineDataSchema({"type_key": "era.dispatch.preparation.plan", "representation": "json", "display_name": "ERA 派发准备计划", "description": "声明消息和元数据的幂等预提交计划。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema83 = defineDataSchema({"type_key": "era.dispatch.seed", "representation": "json", "display_name": "ERA 派发准备种子", "description": "携带规划步骤、批次状态、显式任务来源和上下文要求。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema84 = defineDataSchema({"type_key": "era.expression.command.request", "representation": "json", "display_name": "ERA·表达式·命令·请求", "description": "Service 交给独立表达式 root 的纯命令 DTO：逐消息层起始 statData/statFunc 快照、原文位置有序的六类 ERA 标签、当前同步范围与既有重放身份。它不包含 Tavern 对象、Capability 或文件句柄。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema85 = defineDataSchema({"type_key": "era.expression.command.result", "representation": "json", "display_name": "ERA·表达式·命令·结果", "description": "独立表达式 root 返回的纯结果：顺序执行后的 statData/statFunc、变量与函数编辑日志、定位诊断，以及经同起始双快照重放验证的已封存楼层压缩候选。它尚未形成 Tavern 提交请求。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema86 = defineDataSchema({"type_key": "era.expression.random.cursor.report", "representation": "json", "display_name": "ERA·表达式·消息随机处理位置报告", "description": "记录本条消息重新执行时使用的随机次数，供计算流程核对随机进度。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["randomDrawsConsumed", "nextRandomDrawOffset"], "properties": {"randomDrawsConsumed": {"type": "integer", "minimum": 0}, "nextRandomDrawOffset": {"type": "integer", "minimum": 0}}, "additionalProperties": false}});

export const schema87 = defineDataSchema({"type_key": "era.fatal.route", "representation": "json", "display_name": "ERA·致命状态·路由", "description": "定义“ERA·致命状态·路由”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["continue", "fatal"]}});

export const schema88 = defineDataSchema({"type_key": "era.tavern.character.greeting_refresh.facts", "representation": "json", "display_name": "当前开场白及首条消息资料", "description": "原初始化提交中的刷新事实、计划及结果。", "schema": {"type": "object", "required": ["group", "tainted", "length", "first"], "properties": {"group": {"type": "boolean"}, "tainted": {"type": "boolean"}, "length": {"type": "integer"}, "first": {"type": ["object", "null"], "additionalProperties": true}}, "additionalProperties": false}});

export const schema89 = defineDataSchema({"type_key": "era.tavern.character.greeting_refresh.plan", "representation": "json", "display_name": "首条消息更新、新建或保留计划", "description": "原初始化提交中的刷新事实、计划及结果。", "schema": {"type": "object", "required": ["kind", "next"], "properties": {"kind": {"enum": ["empty", "message"]}, "next": {"type": "string"}, "updated": {"type": "string"}}, "additionalProperties": false}});

export const schema90 = defineDataSchema({"type_key": "era.tavern.character.greeting_refresh.result", "representation": "json", "display_name": "首条消息刷新结果", "description": "原初始化提交中的刷新事实、计划及结果。", "schema": {"type": "object", "required": ["status", "reason"], "properties": {"status": {"enum": ["refreshed", "preserved", "not-applicable"]}, "reason": {"type": "string"}}, "additionalProperties": false}});

export const schema91 = defineDataSchema({"type_key": "era.initialize.changes", "representation": "json", "display_name": "ERA·初始化·变更", "description": "定义“ERA·初始化·变更”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema92 = defineDataSchema({"type_key": "era.initialize.commit.request", "representation": "json", "display_name": "ERA·初始化·提交·请求", "description": "定义“ERA·初始化·提交·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema93 = defineDataSchema({"type_key": "era.initialize.commit.result", "representation": "json", "display_name": "ERA·初始化·提交·结果", "description": "定义“ERA·初始化·提交·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema94 = defineDataSchema({"type_key": "era.initialize.completion.route", "representation": "json", "display_name": "初始化完成路由", "description": "选择直接结算或继续启动同步。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["sync", "finish"]}});

export const schema95 = defineDataSchema({"type_key": "era.initialize.context", "representation": "json", "display_name": "ERA·初始化·上下文", "description": "定义“ERA·初始化·上下文”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema96 = defineDataSchema({"type_key": "era.initialize.direct.result", "representation": "json", "display_name": "直接初始化结果", "description": "保存资源初始化或设置更新的实际结果，供无需后续历史同步的分支直接返回。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema97 = defineDataSchema({"type_key": "era.initialize.plan", "representation": "json", "display_name": "ERA·初始化·计划", "description": "定义“ERA·初始化·计划”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema98 = defineDataSchema({"type_key": "era.initialize.route", "representation": "json", "display_name": "ERA·初始化·路由", "description": "定义“ERA·初始化·路由”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["no-op", "reconcile"]}});

export const schema99 = defineDataSchema({"type_key": "era.initialize.startup.sync.step", "representation": "json", "display_name": "启动同步步骤", "description": "初始化分支专用的启动同步步骤，在进入共享 sync Nodeset 前转为通用 routed step。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema100 = defineDataSchema({"type_key": "era.installation.scope.classification", "representation": "json", "display_name": "ERA 安装作用域分类", "description": "纯规则对启动期脚本归属的分类结果。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["status", "reason"], "additionalProperties": false, "properties": {"status": {"enum": ["character", "global", "preset", "ambiguous", "unknown"]}, "reason": {"type": "string", "minLength": 1}}}});

export const schema101 = defineDataSchema({"type_key": "era.installation.scope.decision", "representation": "json", "display_name": "ERA 安装作用域启动决议", "description": "启动前 workflow 返回给组合层的允许或休眠决议及提示要求。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["classification", "route", "warn"], "additionalProperties": false, "properties": {"classification": {"enum": ["character", "global", "preset", "ambiguous", "unknown"]}, "route": {"enum": ["allow", "dormant"]}, "warn": {"type": "boolean"}}}});

export const schema102 = defineDataSchema({"type_key": "era.installation.scope.facts", "representation": "json", "display_name": "ERA 安装作用域事实", "description": "启动期 Host 对当前脚本 ID 与各作用域启用归属的只读采样。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["scriptId", "scopes", "readStatus"], "additionalProperties": false, "properties": {"scriptId": {"type": ["string", "null"]}, "scopes": {"type": "array", "items": {"enum": ["character", "global", "preset"]}}, "readStatus": {"enum": ["complete", "unavailable", "failed"]}}}});

export const schema103 = defineDataSchema({"type_key": "era.installation.scope.route", "representation": "json", "display_name": "ERA 安装作用域路由", "description": "主 workflow 的启动分支路由。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["allow", "dormant"]}});

export const schema104 = defineDataSchema({"type_key": "era.iteration.route", "representation": "json", "display_name": "ERA·迭代·路由", "description": "定义“ERA·迭代·路由”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["wait", "execute"]}});

export const schema105 = defineDataSchema({
  "type_key": "era.mk.candidate.routed",
  "representation": "json",
  "display_name": "已路由 ERA 消息历史标识候选",
  "description": "路由节点无损转发的 MK 候选；形状与 era.mk.candidate 完全一致。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["schemaVersion", "step", "disposition", "mk", "messageUpdate", "metaUpdate", "messageWriteRequired", "variableWriteRequired", "failure"],
    "properties": {"schemaVersion": {"const": 1}, "step": {"type": "object"}, "disposition": {"type": "string", "enum": ["ready", "failed"]}, "mk": {"type": ["string", "null"]}, "messageUpdate": {"type": ["object", "null"]}, "metaUpdate": {"type": ["object", "null"]}, "messageWriteRequired": {"type": "boolean"}, "variableWriteRequired": {"type": "boolean"}, "failure": {"type": ["object", "null"]}},
    "additionalProperties": false
  }
});

export const schema106 = defineDataSchema({
  "type_key": "era.mk.candidate",
  "representation": "json",
  "display_name": "ERA 消息历史标识提交候选",
  "description": "纯计算产生的消息文本与 ERAMetaData 候选，或进入无写入失败路径的明确错误。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["schemaVersion", "step", "disposition", "mk", "messageUpdate", "metaUpdate", "messageWriteRequired", "variableWriteRequired", "failure"],
    "properties": {"schemaVersion": {"const": 1}, "step": {"type": "object"}, "disposition": {"type": "string", "enum": ["ready", "failed"]}, "mk": {"type": ["string", "null"]}, "messageUpdate": {"type": ["object", "null"], "properties": {"messageId": {"type": "integer", "minimum": 0}, "content": {"type": "string"}}, "required": ["messageId", "content"], "additionalProperties": false}, "metaUpdate": {"type": ["object", "null"]}, "messageWriteRequired": {"type": "boolean"}, "variableWriteRequired": {"type": "boolean"}, "failure": {"type": ["object", "null"]}},
    "additionalProperties": false
  }
});

export const schema107 = defineDataSchema({
  "type_key": "era.mk.commit.request",
  "representation": "json",
  "display_name": "ERA 消息历史标识提交请求",
  "description": "声明先消息后变量的单次逻辑提交所需的明确文本更新、完整 ERAMetaData 与写入标记。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["schemaVersion", "step", "mk", "messageUpdate", "metaUpdate", "messageWriteRequired", "variableWriteRequired"],
    "properties": {"schemaVersion": {"const": 1}, "step": {"type": "object"}, "mk": {"type": "string", "minLength": 1}, "messageUpdate": {"type": ["object", "null"], "properties": {"messageId": {"type": "integer", "minimum": 0}, "content": {"type": "string"}}, "required": ["messageId", "content"], "additionalProperties": false}, "metaUpdate": {"type": "object"}, "messageWriteRequired": {"type": "boolean"}, "variableWriteRequired": {"type": "boolean"}},
    "additionalProperties": false
  }
});

export const schema108 = defineDataSchema({
  "type_key": "era.mk.commit.result",
  "representation": "json",
  "display_name": "ERA 消息历史标识提交结果",
  "description": "记录 no-op、committed、普通失败或 fatal，以及消息与变量两部分是否已经确认写入。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["schemaVersion", "step", "status", "mk", "messageChanged", "variablesChanged", "failure"],
    "properties": {"schemaVersion": {"const": 1}, "step": {"type": "object"}, "status": {"type": "string", "enum": ["committed", "no-op", "failed", "fatal"]}, "mk": {"type": ["string", "null"]}, "messageChanged": {"type": "boolean"}, "variablesChanged": {"type": "boolean"}, "failure": {"type": ["object", "null"], "properties": {"code": {"type": "string", "minLength": 1}, "message": {"type": "string", "minLength": 1}, "category": {"type": "string", "enum": ["input", "domain", "tavern", "cancelled"]}, "retryable": {"const": false}}, "required": ["code", "message", "category", "retryable"]}},
    "additionalProperties": false
  }
});

export const schema109 = defineDataSchema({
  "type_key": "era.mk.context",
  "representation": "json",
  "display_name": "ERA 消息历史标识读取上下文",
  "description": "包含完整 update-mk 步骤、当前激活消息文本、ERAMetaData、状态占位符设置或读取失败；不携带身份或其他宿主状态。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["schemaVersion", "step", "status", "message", "meta", "placeholderSettings", "failure"],
    "properties": {
      "schemaVersion": {"const": 1},
      "step": {"type": "object"},
      "status": {"type": "string", "enum": ["ready", "failed"]},
      "message": {"type": ["object", "null"], "properties": {"messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}}, "required": ["messageId", "role", "activeText"]},
      "meta": {"type": ["object", "null"]},
      "placeholderSettings": {"type": ["object", "null"], "properties": {"enabled": {"type": "boolean"}, "value": {"type": "string"}}, "required": ["enabled", "value"], "additionalProperties": false},
      "failure": {"type": ["object", "null"], "properties": {"code": {"type": "string", "minLength": 1}, "message": {"type": "string", "minLength": 1}, "category": {"type": "string", "enum": ["input", "domain", "tavern", "cancelled"]}, "retryable": {"const": false}}, "required": ["code", "message", "category", "retryable"]}
    },
    "additionalProperties": false
  }
});

export const schema110 = defineDataSchema({"type_key": "era.mk.route", "representation": "json", "display_name": "ERA 消息历史标识提交路由", "description": "选择不触及宿主状态的 no-op 分支或执行逻辑提交的 commit 分支。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["no-op", "commit"]}});

export const schema111 = defineDataSchema({"type_key": "era.service.cycle.completion_route", "representation": "json", "display_name": "单步完成分支", "schema": {"type": "string", "enum": ["continue", "finish"]}, "description": "区分继续执行下一步骤与结束当前批次。"});

export const schema112 = defineDataSchema({"type_key": "era.service.cycle.route", "representation": "json", "display_name": "服务阶段分支", "schema": {"type": "string", "enum": ["collect", "execute"]}, "description": "区分等待并收集事件与执行已规划批次。"});

export const schema113 = defineDataSchema({"type_key": "era.service.cycle.routed", "representation": "json", "display_name": "Service 阶段路由中的状态", "description": "阶段路由后传给唯一分支的原始阶段状态。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "properties": {"schemaVersion": {"const": 1}, "phase": {"enum": ["collect", "execute"]}, "payload": {"type": "object", "additionalProperties": true}}, "required": ["schemaVersion", "phase", "payload"], "additionalProperties": false}});

export const schema114 = defineDataSchema({"type_key": "era.service.cycle.state", "representation": "json", "display_name": "服务收集或执行阶段的运行资料", "description": "保存服务当前处于事件收集还是批次执行阶段，以及该阶段需要的队列、任务和累计结果。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "properties": {"schemaVersion": {"const": 1}, "phase": {"enum": ["collect", "execute"]}, "payload": {"type": "object", "additionalProperties": true}}, "required": ["schemaVersion", "phase", "payload"], "additionalProperties": false}});

export const schema115 = defineDataSchema({
  "type_key": "era.service.state.current",
  "representation": "json",
  "display_name": "ERA 当前服务状态",
  "description": "本次服务迭代读取的有界携带状态。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "schemaVersion": {"const": 1},
      "collection": {
        "type": "array",
        "maxItems": 128,
        "items": {
          "type": "object",
          "allOf": [{"oneOf": [{"type": "object", "properties": {"source": {"enum": ["tavern", "ui", "era-api"]}}, "required": ["source"]}, {"type": "object", "properties": {"source": {"const": "timer"}, "type": {"const": "era.service.collection_timer"}}, "required": ["source", "type"]}]}],
          "properties": {
            "schemaVersion": {"const": 1},
            "eventId": {"type": "string", "minLength": 1},
            "sequence": {"type": "integer", "minimum": 1},
            "type": {"type": "string", "minLength": 1},
            "occurredAt": {"type": "number"},
            "source": {"type": "string", "enum": ["tavern", "ui", "era-api", "timer"]},
            "args": {"type": "array", "items": {"oneOf": [{"type": "object", "properties": {"kind": {"const": "json"}, "value": {}}, "required": ["kind", "value"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "undefined"}}, "required": ["kind"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "host-ref"}, "token": {"type": "string", "minLength": 1}, "refKind": {"type": "string", "minLength": 1}}, "required": ["kind", "token", "refKind"], "additionalProperties": false}]}},
            "encodedBytes": {"type": "integer", "minimum": 0, "maximum": 262144}
          },
          "required": ["schemaVersion", "eventId", "sequence", "type", "occurredAt", "source", "args", "encodedBytes"],
          "additionalProperties": false
        }
      },
      "collectionBytes": {"type": "integer", "minimum": 0, "maximum": 2097152},
      "iteration": {"type": "integer", "minimum": 0},
      "consecutiveProcessingCount": {"type": "integer", "minimum": 0},
      "consecutiveMk": {"oneOf": [{"type": "string", "minLength": 1}, {"type": "null"}]},
      "timerToken": {"oneOf": [{"type": "string", "minLength": 1}, {"type": "null"}]},
      "syncCursor": {"oneOf": [{"type": "null"}, {"type": "object", "properties": {"messageId": {"type": "integer", "minimum": 0}, "mk": {"type": "string", "minLength": 1}, "blockIndex": {"type": "integer", "minimum": 0}}, "required": ["messageId", "mk", "blockIndex"], "additionalProperties": false}]},
      "scopeWindow": {"type": "object", "properties": {"token": {"oneOf": [{"type": "integer", "minimum": 1}, {"type": "null"}]}, "messageId": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}, "messageAdmission": {"oneOf": [{"type": "boolean"}, {"type": "null"}]}, "branchAdmission": {"oneOf": [{"type": "boolean"}, {"type": "null"}]}}, "required": ["token", "messageId", "messageAdmission", "branchAdmission"], "additionalProperties": false}
    },
    "required": ["schemaVersion", "collection", "collectionBytes", "iteration", "consecutiveProcessingCount", "consecutiveMk", "timerToken", "scopeWindow"],
    "additionalProperties": false
  }
});
