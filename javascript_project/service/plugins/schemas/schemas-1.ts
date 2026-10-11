import {defineDataSchema} from "@vibeflow/plugin";

export const schema0 = defineDataSchema({"type_key": "era.tavern.character.single_floor.request", "representation": "json", "schema": {"type": "object", "required": ["characterId", "enabled"], "properties": {"characterId": {"type": "string"}, "enabled": {"type": "boolean"}}}, "display_name": "角色卡单层显示设置请求", "description": "指定角色卡及其单层显示开关。"});

export const schema1 = defineDataSchema({"type_key": "era.tavern.character.single_floor.result", "representation": "json", "schema": {"type": "object"}, "display_name": "角色卡单层显示设置结果", "description": "返回本次单层显示设置的宿主处理结果。"});

export const schema2 = defineDataSchema({
  "type_key": "era.agent.auxiliary.execution_request",
  "representation": "json",
  "display_name": "ERA 多阶段生成 辅助阶段执行请求",
  "description": "保存规划或结算阶段所需的角色配置、预设摘要和本机模型连接引用。连接使用方案标识及名称，供宿主找到实际连接配置。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": false,
    "required": ["schemaVersion", "routedStep", "executionState", "hostContext", "configurationVersion", "migrationMode", "configuration", "stages", "diagnostics"],
    "properties": {
      "schemaVersion": {"const": 2},
      "routedStep": {"type": "object", "additionalProperties": true},
      "executionState": {"type": "object", "additionalProperties": true},
      "hostContext": {"oneOf": [{"type": "object", "additionalProperties": true}, {"type": "null"}]},
      "configurationVersion": {"oneOf": [{"enum": ["1", "2"]}, {"type": "null"}]},
      "migrationMode": {"enum": ["not-applicable", "v1-preserved", "v2"]},
      "configuration": {"type": "object", "additionalProperties": true},
      "stages": {
        "type": "array",
        "maxItems": 2,
        "items": {
          "type": "object",
          "additionalProperties": false,
          "required": ["stage", "enabled", "retryCount", "attempts"],
          "properties": {
            "stage": {"enum": ["planning", "settlement"]},
            "enabled": {"type": "boolean"},
            "retryCount": {"type": "integer", "minimum": 0, "maximum": 16},
            "attempts": {
              "type": "array",
              "minItems": 1,
              "maxItems": 17,
              "items": {
                "type": "object",
                "additionalProperties": false,
                "required": ["preset", "modelSource"],
                "properties": {
                  "preset": {"type": "object", "additionalProperties": false, "required": ["source"], "properties": {"source": {"enum": ["builtin", "snapshot"]}, "sourceName": {"type": "string", "maxLength": 256}, "orderedPrompts": {"type": "array", "maxItems": 256, "items": {"oneOf": [{"type": "string"}, {"type": "object", "additionalProperties": true}]}}, "settings": {"type": "object", "additionalProperties": true}}},
                  "modelSource": {"type": "object", "additionalProperties": false, "required": ["kind"], "properties": {"kind": {"enum": ["tavern-current", "custom-profile"]}, "profileId": {"type": "string", "minLength": 1, "maxLength": 256}, "profileNameHint": {"type": "string", "maxLength": 256}, "model": {"type": "string", "minLength": 1, "maxLength": 512}, "legacyModelOverride": {"type": "string", "minLength": 1, "maxLength": 512}}}
                }
              }
            }
          }
        }
      },
      "diagnostics": {"type": "array", "maxItems": 128, "items": {"type": "object", "additionalProperties": false, "required": ["code", "message"], "properties": {"code": {"type": "string", "minLength": 1, "maxLength": 256}, "message": {"type": "string", "maxLength": 4096}}}}
    }
  }
});

export const schema3 = defineDataSchema({"type_key": "era.agent.candidate.done", "display_name": "本阶段是否已成功或无法继续", "representation": "json", "schema": {"type": "boolean"}, "description": "为真时结束候选重试循环；为假时使用更新后的请求再试一次。"});

export const schema4 = defineDataSchema({"type_key": "era.agent.candidate.outcome", "display_name": "候选循环最终结果", "representation": "json", "schema": {"type": "object", "additionalProperties": true}, "description": "候选完成后交给生成会话的结果；内部重试请求不向外传播。"});

export const schema5 = defineDataSchema({"type_key": "era.agent.candidate.state.next", "display_name": "本次尝试后的进度及重试请求", "representation": "json", "schema": {"type": "object", "additionalProperties": false, "required": ["request", "step", "executionState"], "properties": {"request": {"type": "object", "additionalProperties": true}, "step": {"type": "object", "additionalProperties": true}, "executionState": {"type": "object", "additionalProperties": true}}}, "description": "保留步骤与批次状态，并在需要重试时替换生成请求。"});

export const schema6 = defineDataSchema({"type_key": "era.agent.candidate.state", "display_name": "本次模型尝试的请求、起点和进度", "representation": "json", "schema": {"type": "object", "additionalProperties": false, "required": ["request", "step", "executionState"], "properties": {"request": {"type": "object", "additionalProperties": true}, "step": {"type": "object", "additionalProperties": true}, "executionState": {"type": "object", "additionalProperties": true}}}, "description": "保存本次候选的生成请求、已准备步骤和所属批次状态。"});

export const schema7 = defineDataSchema({
  "type_key": "era.agent.connection.state",
  "representation": "json",
  "display_name": "本机连接公开事实",
  "description": "当前记录数、查找键存在性与有效记录摘要，不包含秘密值。",
  "schema": {"type": "object", "required": ["entryCount", "entryExists", "profile"], "additionalProperties": false, "properties": {"entryCount": {"type": "integer", "minimum": 0}, "entryExists": {"type": "boolean"}, "profile": {"type": ["object", "null"], "properties": {"id": {"type": "string"}, "name": {"type": "string"}, "apiUrl": {"type": "string"}, "hasKey": {"type": "boolean"}}, "required": ["id", "name", "apiUrl", "hasKey"], "additionalProperties": false}}}
});

export const schema8 = defineDataSchema({
  "type_key": "era.agent.function_call.result",
  "representation": "json",
  "display_name": "ERA 多阶段生成 纯函数调用结果",
  "description": "按调用顺序保存已计算函数的名称、数值、消息历史标识和随机使用范围，供生成阶段整理结果。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": false,
    "required": ["schemaVersion", "status", "messageMk", "drawStart", "drawEnd", "calls", "diagnostics"],
    "properties": {
      "schemaVersion": {"const": 1},
      "status": {"enum": ["ready", "planning-exhausted", "failed", "cancelled"]},
      "messageMk": {"oneOf": [{"type": "string", "minLength": 1, "maxLength": 512}, {"type": "null"}]},
      "drawStart": {"type": "integer", "minimum": 0},
      "drawEnd": {"type": "integer", "minimum": 0},
      "calls": {"type": "array", "maxItems": 32, "items": {"type": "object", "additionalProperties": false, "required": ["index", "function", "args", "result"], "properties": {"index": {"type": "integer", "minimum": 0, "maximum": 31}, "function": {"type": "string", "minLength": 1, "maxLength": 256}, "args": {"type": "array", "maxItems": 32, "items": {"type": "number"}}, "result": {"oneOf": [{"type": "number"}, {"type": "null"}]}}}},
      "diagnostics": {"type": "array", "maxItems": 128, "items": {"type": "string", "maxLength": 4096}}
    }
  }
});

export const schema9 = defineDataSchema({"type_key": "era.agent.generation.decision", "display_name": "生成阶段决策", "representation": "json", "schema": {"type": "object", "additionalProperties": true}, "description": "记录当前生成事件应继续执行、恢复还是直接结算。"});

export const schema10 = defineDataSchema({"type_key": "era.agent.generation.facts", "display_name": "生成事件与会话事实", "representation": "json", "schema": {"type": "object", "additionalProperties": true}, "description": "汇集生成事件、来源及当前会话状态供阶段判断。"});

export const schema11 = defineDataSchema({"type_key": "era.agent.generation.outcome", "display_name": "生成阶段执行结果", "representation": "json", "schema": {"type": "object", "additionalProperties": true}, "description": "记录一次生成阶段的执行结果与后续阶段所需事实。"});

export const schema12 = defineDataSchema({"type_key": "era.agent.generation.raw", "display_name": "尚未应用的生成输出", "representation": "json", "schema": {"type": "object", "additionalProperties": true}, "description": "保留模型原文，待共用块执行流程按位置应用。"});

export const schema13 = defineDataSchema({"type_key": "era.agent.generation.request", "display_name": "生成阶段所需输入", "representation": "json", "schema": {"type": "object", "additionalProperties": true}, "description": "保存本阶段发给模型的请求及继续执行所需上下文。"});

export const schema14 = defineDataSchema({
  "type_key": "era.agent.host.request",
  "representation": "json",
  "display_name": "ERA 多阶段生成 宿主请求",
  "description": "保存 Service 要求酒馆或模型接口执行的具体生成、设置或页面操作，供宿主调用。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true,
    "properties": {
      "requestPolicy": {
        "type": "object",
        "required": ["binding", "sampling"],
        "additionalProperties": false,
        "properties": {
          "binding": {"type": "object", "required": ["kind", "profileId", "model"], "properties": {"kind": {"enum": ["custom-profile", "tavern-current"]}, "profileId": {}, "model": {"type": ["string", "null"]}}, "additionalProperties": false},
          "sampling": {
            "type": "object",
            "required": ["maxTokens", "temperature", "frequencyPenalty", "presencePenalty", "topP", "topK"],
            "properties": {"maxTokens": {"anyOf": [{"type": "number"}, {"const": "same_as_preset"}]}, "temperature": {"anyOf": [{"type": "number"}, {"const": "same_as_preset"}]}, "frequencyPenalty": {"anyOf": [{"type": "number"}, {"const": "same_as_preset"}]}, "presencePenalty": {"anyOf": [{"type": "number"}, {"const": "same_as_preset"}]}, "topP": {"anyOf": [{"type": "number"}, {"const": "same_as_preset"}]}, "topK": {"anyOf": [{"type": "number"}, {"const": "same_as_preset"}]}},
            "additionalProperties": false
          }
        }
      },
      "sourceId": {"type": ["string", "null"]},
      "keyMode": {"enum": ["clear", "replace-if-nonempty-otherwise-preserve"]},
      "status": {"enum": ["created", "updated"]}
    }
  }
});

export const schema15 = defineDataSchema({
  "type_key": "era.agent.host.result",
  "representation": "json",
  "display_name": "ERA 多阶段生成 宿主结果",
  "description": "Agent Host capability 返回的脱敏、可序列化、有界事实或模型原文。",
  "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true, "properties": {"requestedName": {"type": "string"}, "loadedName": {"type": ["string", "null"]}, "prompts": {"type": "array", "maxItems": 256, "items": {"type": "object", "required": ["id", "enabled", "role", "content"], "properties": {"id": {"type": ["string", "null"]}, "enabled": {"type": "boolean"}, "role": {"type": ["string", "null"]}, "content": {"type": ["string", "null"]}}, "additionalProperties": false}}}}
});

export const schema16 = defineDataSchema({
  "type_key": "era.agent.planning.attempt_result",
  "representation": "json",
  "display_name": "ERA 规划尝试结果",
  "description": "保存有界规划尝试、严格故事计划、最多 32 项函数调用表及可定位诊断。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": false,
    "required": ["schemaVersion", "status", "attempts", "storyPlan", "calls"],
    "properties": {
      "schemaVersion": {"const": 1},
      "status": {"enum": ["ready", "exhausted", "failed", "cancelled"]},
      "attempts": {"type": "array", "maxItems": 17, "items": {"type": "object", "additionalProperties": false, "required": ["index", "output", "diagnostics"], "properties": {"index": {"type": "integer", "minimum": 0, "maximum": 16}, "output": {"type": "string", "maxLength": 262144}, "diagnostics": {"type": "array", "maxItems": 128, "items": {"type": "string", "maxLength": 4096}}}}},
      "storyPlan": {"oneOf": [{"type": "object", "additionalProperties": true}, {"type": "null"}]},
      "calls": {"type": "array", "maxItems": 32, "items": {"type": "object", "additionalProperties": false, "required": ["function", "args"], "properties": {"function": {"type": "string", "minLength": 1, "maxLength": 256}, "args": {"type": "array", "maxItems": 32, "items": {"type": "number"}}, "purpose": {"type": "string", "maxLength": 4096}}}}
    }
  }
});

export const schema17 = defineDataSchema({"type_key": "era.agent.session.binding.facts", "representation": "json", "display_name": "会话关联即时事实", "description": "原生生成是否活动及旧会话关联字段，不含宿主控制器。", "schema": {"type": "object", "required": ["active", "previous"], "additionalProperties": false, "properties": {"active": {"type": "boolean"}, "previous": {"type": ["object", "null"], "properties": {"execution": {}, "storyRequestId": {}, "nativeGeneration": {}}, "additionalProperties": false}}}});

export const schema18 = defineDataSchema({
  "type_key": "era.agent.session.context",
  "representation": "json",
  "display_name": "ERA 故事生成会话上下文",
  "description": "Service 从已路由事件与 Host 脱敏投影组合出的有界角色卡、聊天、分支、消息、配置和活动会话上下文。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": false,
    "required": ["schemaVersion", "eventType", "chatKey", "branchKey", "speakerKey", "messageId", "swipeIndex", "revision", "configuration", "session"],
    "properties": {
      "schemaVersion": {"const": 1},
      "eventType": {"type": "string", "minLength": 1, "maxLength": 128},
      "chatKey": {"type": "string", "minLength": 1, "maxLength": 512},
      "branchKey": {"type": "string", "minLength": 1, "maxLength": 512},
      "speakerKey": {"type": "string", "minLength": 1, "maxLength": 512},
      "messageId": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]},
      "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]},
      "revision": {"type": "string", "minLength": 1, "maxLength": 512},
      "configuration": {"type": "object", "additionalProperties": true},
      "session": {"oneOf": [{"type": "object", "additionalProperties": true}, {"type": "null"}]}
    }
  }
});

export const schema19 = defineDataSchema({"type_key": "era.agent.session.route", "representation": "json", "display_name": "ERA 故事生成会话路由", "description": "把四种阶段模式折叠为委托原任务或直接结算两条互斥工作流分支；完整模式仍保留在 transition 中。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["legacy", "direct"]}});

export const schema20 = defineDataSchema({
  "type_key": "era.agent.session.transition",
  "representation": "json",
  "display_name": "ERA 故事生成会话转换结果",
  "description": "统一承载默认委托、阶段推进、设置保存、取消和失败后的会话状态更新与任务结算候选。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": false,
    "required": ["schemaVersion", "step", "mode", "status", "diagnostics"],
    "properties": {
      "schemaVersion": {"const": 1},
      "step": {"type": "object", "additionalProperties": true},
      "mode": {"enum": ["legacy", "legacy-ignore", "execute-legacy", "execute-only"]},
      "status": {"enum": ["committed", "no-op", "failed"]},
      "value": {},
      "diagnostics": {"type": "array", "maxItems": 128, "items": {"type": "object", "additionalProperties": false, "required": ["code", "message"], "properties": {"code": {"type": "string", "minLength": 1, "maxLength": 256}, "message": {"type": "string", "maxLength": 4096}}}},
      "handoff": {"type": "object", "additionalProperties": false, "required": ["executionId", "completionId", "trigger", "chatKey", "stage", "result"], "properties": {"executionId": {"type": "string"}, "completionId": {"type": "string"}, "trigger": {"type": "string"}, "chatKey": {"type": "string"}, "stage": {"enum": ["planning", "story", "settlement"]}, "result": {"type": "object", "additionalProperties": true}, "messageId": {"type": "integer", "minimum": 0}, "mk": {"type": "string"}, "swipeId": {"type": "integer", "minimum": 0}}}
    }
  }
});

export const schema21 = defineDataSchema({"type_key": "era.agent.settings.outcome", "display_name": "多阶段生成 设置命令结果", "representation": "json", "schema": {"type": "object", "additionalProperties": true}, "description": "记录配置、预设、连接或模型列表命令的处理结果。"});

export const schema22 = defineDataSchema({"type_key": "era.agent.settings.request", "display_name": "多阶段生成 设置命令请求", "representation": "json", "schema": {"type": "object", "additionalProperties": true}, "description": "保存已识别的设置命令及执行所需上下文。"});

export const schema23 = defineDataSchema({
  "type_key": "era.agent.settlement.attempt_result",
  "representation": "json",
  "display_name": "ERA 变量分析尝试结果",
  "description": "保存有界变量分析尝试、最终分析文本、候选有序 operations 与精确诊断。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": false,
    "required": ["schemaVersion", "status", "attempts", "analysis", "operations"],
    "properties": {
      "schemaVersion": {"const": 1},
      "status": {"enum": ["ready", "exhausted", "failed", "cancelled"]},
      "attempts": {"type": "array", "maxItems": 17, "items": {"type": "object", "additionalProperties": false, "required": ["index", "output", "diagnostics"], "properties": {"index": {"type": "integer", "minimum": 0, "maximum": 16}, "output": {"type": "string", "maxLength": 262144}, "diagnostics": {"type": "array", "maxItems": 128, "items": {"type": "string", "maxLength": 4096}}}}},
      "analysis": {"oneOf": [{"type": "string", "maxLength": 262144}, {"type": "null"}]},
      "operations": {"type": "array", "maxItems": 128, "items": {"type": "object", "additionalProperties": true}}
    }
  }
});

export const schema24 = defineDataSchema({
  "type_key": "era.agent.settlement.validated",
  "representation": "json",
  "display_name": "ERA 已校验变量结算",
  "description": "保存生成阶段分析后可应用的消息命令，或本次尚未完成变量结算的状态与原因。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": false,
    "required": ["schemaVersion", "status", "operations", "eraTx", "diagnostics"],
    "properties": {"schemaVersion": {"const": 1}, "status": {"enum": ["ready", "unsettled", "failed", "cancelled"]}, "operations": {"type": "array", "maxItems": 128, "items": {"type": "object", "additionalProperties": true}}, "eraTx": {"oneOf": [{"type": "string", "minLength": 1, "maxLength": 1048576, "pattern": "^<era_tx s=\\\"m\\\">"}, {"type": "null"}]}, "diagnostics": {"type": "array", "maxItems": 128, "items": {"type": "string", "maxLength": 4096}}}
  }
});

export const schema25 = defineDataSchema({
  "type_key": "era.agent.story.capture",
  "representation": "json",
  "display_name": "ERA 多阶段生成 故事捕获",
  "description": "保存当前 Swipe 的干净故事、被隔离的故事模型 ERA 标签、故事前状态引用及计划函数证据。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": false,
    "required": ["schemaVersion", "messageId", "swipeIndex", "revision", "story", "isolatedEraTags", "baseline"],
    "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "swipeIndex": {"type": "integer", "minimum": 0}, "revision": {"type": "string", "minLength": 1, "maxLength": 512}, "story": {"type": "string", "maxLength": 1048576}, "isolatedEraTags": {"type": "array", "maxItems": 256, "items": {"type": "string", "maxLength": 262144}}, "baseline": {"type": "object", "additionalProperties": true}}
  }
});

export const schema26 = defineDataSchema({"type_key": "era.api.commit.admission.route", "representation": "json", "display_name": "即时 变量提交 准入路由", "description": "选择 commit、skipped 或 failed。", "schema": {"type": "string", "enum": ["commit", "skipped", "failed"]}});

export const schema27 = defineDataSchema({"type_key": "era.api.commit.failure_context", "representation": "json", "display_name": "即时 变量提交 失败上下文", "description": "校验、窗口或消息失败的结构化上下文。", "schema": {"type": "object", "additionalProperties": true}});

export const schema28 = defineDataSchema({"type_key": "era.api.commit.inspected", "representation": "json", "display_name": "即时 变量提交 窗口事实", "description": "当前身份、消息、目标与内存准入事实。", "schema": {"type": "object", "additionalProperties": true}});

export const schema29 = defineDataSchema({"type_key": "era.api.commit.result", "representation": "json", "display_name": "即时 变量提交 分支结果", "description": "互斥的 committed、skipped 或 failed 结果。", "schema": {"type": "object", "additionalProperties": true}});

export const schema30 = defineDataSchema({"type_key": "era.api.commit.target", "representation": "json", "display_name": "即时 变量提交 目标", "description": "写入前重新读取的最新 AI 消息目标。", "schema": {"type": "object", "additionalProperties": true}});

export const schema31 = defineDataSchema({"type_key": "era.api.commit.transaction", "representation": "json", "display_name": "单次 ERA 命令文本", "description": "本次调用独立生成的单 scope 事务。", "schema": {"type": "object", "additionalProperties": true}});

export const schema32 = defineDataSchema({"type_key": "era.api.commit.validated", "representation": "json", "display_name": "已校验即时 变量提交", "description": "携带 scope 与有序操作的已准入或 skipped 上下文。", "schema": {"type": "object", "additionalProperties": true}});

export const schema33 = defineDataSchema({"type_key": "era.api.facade.result", "representation": "json", "display_name": "公共 公共接口 任务结果", "description": "commit 或 sync 的唯一互斥结果。", "schema": {"type": "object", "additionalProperties": true}});

export const schema34 = defineDataSchema({"type_key": "era.api.request", "representation": "json", "display_name": "ERA 公共对象请求", "description": "保存提交或同步命令、原事件来源和已准备聊天资料，供公共接口任务执行。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["task", "sources"], "properties": {"task": {"type": "object"}, "sources": {"type": "array", "minItems": 1, "maxItems": 128, "items": {"type": "object"}}, "dispatchContext": {}, "detail": {"type": "object"}}, "additionalProperties": false}});

export const schema35 = defineDataSchema({"type_key": "era.api.route", "representation": "json", "display_name": "ERA 公共对象路由", "description": "内部 Facade 的 commit、sync 或失败路由。", "schema": {"type": "string", "enum": ["commit", "sync", "failed"]}});

export const schema36 = defineDataSchema({"type_key": "era.api.sync.context", "representation": "json", "display_name": "公共对象同步上下文", "description": "同步步骤或输入失败上下文。", "schema": {"type": "object", "additionalProperties": true}});

export const schema37 = defineDataSchema({"type_key": "era.api.sync.result", "representation": "json", "display_name": "公共对象同步分支结果", "description": "互斥的同步成功或输入失败结果。", "schema": {"type": "object", "additionalProperties": true}});

export const schema38 = defineDataSchema({"type_key": "era.api.sync.route", "representation": "json", "display_name": "公共对象同步路由", "description": "选择 sync 或 failed。", "schema": {"type": "string", "enum": ["sync", "failed"]}});

export const schema39 = defineDataSchema({
  "type_key": "era.api.task.result",
  "representation": "json",
  "display_name": "ERA 公共对象任务结果",
  "description": "保存公共接口任务的执行状态、返回值、回执和诊断，供原请求结算。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "status": {"type": "string", "enum": ["committed", "no-op", "failed", "fatal"]},
      "settlements": {
        "type": "array",
        "maxItems": 128,
        "items": {
          "oneOf": [
            {"type": "object", "properties": {"eventId": {"type": "string", "minLength": 1}, "sequence": {"type": "integer", "minimum": 1}, "status": {"const": "completed"}, "taskId": {"type": "string", "minLength": 1}, "relation": {"type": "string", "enum": ["primary", "combined", "coalesced"]}, "value": {}}, "required": ["eventId", "sequence", "status", "taskId", "relation"], "additionalProperties": false},
            {"type": "object", "properties": {"eventId": {"type": "string", "minLength": 1}, "sequence": {"type": "integer", "minimum": 1}, "status": {"const": "ignored"}, "reason": {"type": "string", "minLength": 1}}, "required": ["eventId", "sequence", "status", "reason"], "additionalProperties": false},
            {
              "type": "object",
              "properties": {"eventId": {"type": "string", "minLength": 1}, "sequence": {"type": "integer", "minimum": 1}, "status": {"const": "failed"}, "error": {"type": "object", "properties": {"code": {"type": "string", "minLength": 1}, "message": {"type": "string"}, "category": {"type": "string", "enum": ["input", "domain", "tavern", "cancelled"]}, "retryable": {"type": "boolean"}, "details": {"type": "object", "additionalProperties": true}}, "required": ["code", "message", "category", "retryable"], "additionalProperties": false}},
              "required": ["eventId", "sequence", "status", "error"],
              "additionalProperties": false
            },
            {"type": "object", "properties": {"eventId": {"type": "string", "minLength": 1}, "sequence": {"type": "integer", "minimum": 1}, "status": {"const": "cancelled"}, "reason": {"type": "string", "minLength": 1}}, "required": ["eventId", "sequence", "status", "reason"], "additionalProperties": false}
          ]
        }
      },
      "notifications": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {"type": {"type": "string", "minLength": 1}, "args": {"type": "array", "items": {"oneOf": [{"type": "object", "properties": {"kind": {"const": "json"}, "value": {}}, "required": ["kind", "value"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "undefined"}}, "required": ["kind"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "host-ref"}, "token": {"type": "string", "minLength": 1}, "refKind": {"type": "string", "minLength": 1}}, "required": ["kind", "token", "refKind"], "additionalProperties": false}]}}},
          "required": ["type", "args"],
          "additionalProperties": false
        }
      },
      "diagnostics": {"type": "array", "items": {"type": "object", "properties": {"code": {"type": "string", "minLength": 1}, "message": {"type": "string"}, "sequence": {"oneOf": [{"type": "integer", "minimum": 1}, {"type": "null"}]}}, "required": ["code", "message", "sequence"], "additionalProperties": false}},
      "stateUpdate": {
        "type": "object",
        "properties": {
          "consecutiveMk": {"oneOf": [{"type": "string", "minLength": 1}, {"type": "null"}]},
          "consecutiveProcessingCount": {"type": "integer", "minimum": 0},
          "syncCursor": {"oneOf": [{"type": "null"}, {"type": "object", "properties": {"messageId": {"type": "integer", "minimum": 0}, "mk": {"type": "string", "minLength": 1}, "blockIndex": {"type": "integer", "minimum": 0}}, "required": ["messageId", "mk", "blockIndex"], "additionalProperties": false}]},
          "scopeWindow": {"type": "object", "properties": {"token": {"oneOf": [{"type": "integer", "minimum": 1}, {"type": "null"}]}, "messageId": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}, "messageAdmission": {"oneOf": [{"type": "boolean"}, {"type": "null"}]}, "branchAdmission": {"oneOf": [{"type": "boolean"}, {"type": "null"}]}}, "required": ["token", "messageId", "messageAdmission", "branchAdmission"], "additionalProperties": false}
        },
        "required": ["consecutiveMk", "consecutiveProcessingCount"],
        "additionalProperties": false
      }
    },
    "required": ["status", "settlements", "notifications", "diagnostics"],
    "additionalProperties": false
  }
});

export const schema40 = defineDataSchema({"type_key": "era.api.window.recheck.route", "representation": "json", "display_name": "窗口复核路由", "description": "选择 current 或 changed。", "schema": {"type": "string", "enum": ["current", "changed"]}});

export const schema41 = defineDataSchema({"type_key": "era.batch.coverage.route", "representation": "json", "display_name": "ERA·批次·覆盖·路由", "description": "定义“ERA·批次·覆盖·路由”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["execute", "invalid"]}});
