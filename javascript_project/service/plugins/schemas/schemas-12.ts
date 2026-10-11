import {defineDataSchema} from "@vibeflow/plugin";

export const schema147 = defineDataSchema({"type_key": "era.sync.route", "representation": "json", "display_name": "ERA·同步·路由", "description": "定义“ERA·同步·路由”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["no-op", "crud", "reconcile"]}});

export const schema148 = defineDataSchema({"type_key": "era.sync.source.block.route", "representation": "json", "display_name": "下一段正文是指令、作者调用还是消息结束", "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。", "schema": {"type": "string", "enum": ["command", "author-call", "skip", "floor-end"]}});

export const schema149 = defineDataSchema({"type_key": "era.sync.stage.position.route", "representation": "json", "display_name": "阶段调用位置", "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。", "schema": {"type": "string", "enum": ["calls", "source"]}});

export const schema150 = defineDataSchema({"type_key": "era.sync.work", "representation": "json", "display_name": "ERA·同步·工作项", "description": "定义“ERA·同步·工作项”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema151 = defineDataSchema({"type_key": "era.task.action.route", "display_name": "这项任务接下来要执行的动作", "representation": "json", "schema": {"type": "string", "enum": ["commit", "sync", "candidate", "simple", "update-mk", "direct"]}});

export const schema152 = defineDataSchema({"type_key": "era.task.completion.route", "representation": "json", "display_name": "外层结算分支", "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。", "schema": {"type": "string", "enum": ["api", "ordinary"]}});

export const schema153 = defineDataSchema({"type_key": "era.task.continuation.context", "representation": "json", "display_name": "原任务接续上下文", "description": "保留原步骤、来源与批次和 API/生成适配依据，执行返回后才结算；不是跨迭代持久化状态。", "schema": {"type": "object", "properties": {"origin": {"type": "string", "enum": ["sync", "initialize", "api", "agent"]}, "step": {"type": "object"}, "executionState": {"type": "object"}, "apiContext": {"type": ["object", "null"]}, "initializationContext": {"type": ["object", "null"]}, "agentContext": {"type": ["object", "null"]}}, "required": ["origin", "step", "executionState"], "additionalProperties": false}});

export const schema154 = defineDataSchema({"type_key": "era.task.entry.route", "representation": "json", "display_name": "任务入口", "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。", "schema": {"type": "string", "enum": ["initialize", "api", "agent", "sync", "simple"]}});

export const schema155 = defineDataSchema({"type_key": "era.task.execution.request", "representation": "json", "display_name": "共享执行流程执行请求", "description": "保存选定的提交、历史同步、生成候选或直接返回请求，以及原任务回执资料。", "schema": {"type": "object", "properties": {"kind": {"type": "string", "enum": ["sync", "commit", "candidate", "update-mk", "direct"]}, "payload": {"type": "object"}}, "required": ["kind", "payload"], "additionalProperties": false}});

export const schema156 = defineDataSchema({"type_key": "era.task.execution.result", "representation": "json", "display_name": "核心执行结果与原任务", "description": "只在核心真实执行或准备明确直接结果后产生，供恢复原 API 或任务回执，不重复业务计算。", "schema": {"type": "object", "properties": {"kind": {"type": "string", "enum": ["sync", "commit", "direct", "update-mk"]}, "value": {"type": "object"}, "continuation": {"type": "object"}}, "required": ["kind", "value", "continuation"], "additionalProperties": false}});

export const schema157 = defineDataSchema({"type_key": "era.task.execution.route", "representation": "json", "display_name": "执行分支", "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。", "schema": {"type": "string", "enum": ["sync", "commit", "candidate", "update-mk", "direct"]}});

export const schema158 = defineDataSchema({"type_key": "era.task.family.route", "representation": "json", "display_name": "ERA 服务任务族路由", "description": "统一准备后，仅用于选择 Service 直属复杂任务或简单任务分支；原 PlannedStep 任务路由保持独立。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["initialize", "api", "agent-generation-session", "simple"]}});

export const schema159 = defineDataSchema({"type_key": "era.task.prepared", "representation": "json", "display_name": "任务准备结果", "description": "保存已经准备好、接下来需要执行的请求，以及原任务、事件来源和批次资料。", "schema": {"type": "object", "properties": {"request": {"type": "object"}, "continuation": {"type": "object"}}, "required": ["request", "continuation"], "additionalProperties": false}});

export const schema160 = defineDataSchema({
  "type_key": "era.task.result",
  "representation": "json",
  "display_name": "ERA 任务结果",
  "description": "保存单个任务的实际状态、原事件回执、页面通知和诊断，供批次汇总。",
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

export const schema161 = defineDataSchema({"type_key": "era.task.route", "representation": "json", "display_name": "ERA 任务路由", "description": "显式区分初始化、同步、API、MK 更新、Agent 生成会话与忽略步骤。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["initialize", "sync", "api", "update-mk", "agent-generation-session", "ignore", "agent-settings"]}});

export const schema162 = defineDataSchema({"type_key": "era.tavern.character.external_statusbar.request", "representation": "json", "schema": {"type": "object"}, "display_name": "角色卡外置状态栏请求", "description": "向酒馆宿主请求读取或设置角色卡外置状态栏。"});

export const schema163 = defineDataSchema({"type_key": "era.tavern.character.external_statusbar.result", "representation": "json", "schema": {"type": "object"}, "display_name": "角色卡外置状态栏结果", "description": "返回酒馆宿主处理外置状态栏请求的结果。"});

export const schema164 = defineDataSchema({"type_key": "era.tavern.character.read_main_greeting.request", "representation": "json", "display_name": "ERA·酒馆·角色·读取主开场白·请求", "description": "读取当前角色主开场白的机械请求。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema165 = defineDataSchema({"type_key": "era.tavern.character.read_main_greeting.result", "representation": "json", "display_name": "ERA·酒馆·角色·读取主开场白·结果", "description": "当前角色主开场白的可移植投影。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema166 = defineDataSchema({"type_key": "era.tavern.character.write_main_greeting.request", "representation": "json", "display_name": "ERA·酒馆·角色·写入主开场白·请求", "description": "包含期望旧值与目标新值的主开场白乐观更新请求。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema167 = defineDataSchema({"type_key": "era.tavern.character.write_main_greeting.result", "representation": "json", "display_name": "ERA·酒馆·角色·写入主开场白·结果", "description": "主开场白写入确认与回读结果。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema168 = defineDataSchema({"type_key": "era.tavern.commit.request", "representation": "json", "display_name": "ERA·酒馆·提交·请求", "description": "定义“ERA·酒馆·提交·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema169 = defineDataSchema({"type_key": "era.tavern.commit.result", "representation": "json", "display_name": "ERA·酒馆·提交·结果", "description": "定义“ERA·酒馆·提交·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema170 = defineDataSchema({"type_key": "era.tavern.identity.read.request", "representation": "json", "display_name": "ERA·酒馆·身份·读取·请求", "description": "定义“ERA·酒馆·身份·读取·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema171 = defineDataSchema({"type_key": "era.tavern.identity.read.result", "representation": "json", "display_name": "ERA·酒馆·身份·读取·结果", "description": "定义“ERA·酒馆·身份·读取·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema172 = defineDataSchema({"type_key": "era.tavern.installation_scope.read.request", "representation": "json", "display_name": "安装作用域读取请求", "description": "无输入的启动期脚本树读取请求。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": false}});

export const schema173 = defineDataSchema({
  "type_key": "era.tavern.messages.read_context.outcome",
  "representation": "json",
  "display_name": "ERA 消息读取结果封装",
  "description": "在严格 Capability 投影外层记录成功值或带类型读取失败，供领域任务普通失败结算。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "oneOf": [
      {"type": "object", "additionalProperties": false, "required": ["ok", "value"], "properties": {"ok": {"const": true}, "value": {"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messages"], "properties": {"schemaVersion": {"const": 2}, "messages": {"type": "array"}}}}},
      {"type": "object", "additionalProperties": false, "required": ["ok", "error"], "properties": {"ok": {"const": false}, "error": {"type": "object", "additionalProperties": false, "required": ["code", "message"], "properties": {"code": {"type": "string", "minLength": 1}, "message": {"type": "string"}}}}}
    ]
  }
});

export const schema174 = defineDataSchema({"type_key": "era.tavern.messages.read_context.request", "representation": "json", "display_name": "ERA·酒馆·消息·读取·上下文·请求", "description": "定义“ERA·酒馆·消息·读取·上下文·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": false, "required": ["projection", "range"], "properties": {"projection": {"const": "era-active-message-v1"}, "range": {"oneOf": [{"type": "string", "minLength": 1}, {"type": "integer"}]}, "purpose": {"type": "string", "minLength": 1}}}});

export const schema175 = defineDataSchema({
  "type_key": "era.tavern.messages.read_context.result",
  "representation": "json",
  "display_name": "ERA·酒馆·消息·读取·上下文·结果",
  "description": "定义“ERA·酒馆·消息·读取·上下文·结果”的数据结构与校验约束。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": false,
    "required": ["schemaVersion", "messages"],
    "properties": {"schemaVersion": {"const": 2}, "messages": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}}}
  }
});

export const schema176 = defineDataSchema({"type_key": "era.tavern.messages.refresh.request", "representation": "json", "display_name": "ERA·酒馆·消息·刷新·请求", "description": "定义“ERA·酒馆·消息·刷新·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema177 = defineDataSchema({"type_key": "era.tavern.messages.refresh.result", "representation": "json", "display_name": "ERA·酒馆·消息·刷新·结果", "description": "定义“ERA·酒馆·消息·刷新·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema178 = defineDataSchema({"type_key": "era.tavern.messages.update_content.request", "representation": "json", "display_name": "ERA·酒馆·消息·更新·内容·请求", "description": "定义“ERA·酒馆·消息·更新·内容·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true, "properties": {"expectedSidecarId": {"type": ["string", "null"]}}}});

export const schema179 = defineDataSchema({"type_key": "era.tavern.messages.update_content.result", "representation": "json", "display_name": "ERA·酒馆·消息·更新·内容·结果", "description": "定义“ERA·酒馆·消息·更新·内容·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema180 = defineDataSchema({"type_key": "era.tavern.regex.read.request", "representation": "json", "display_name": "ERA·酒馆·正则·读取·请求", "description": "定义“ERA·酒馆·正则·读取·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema181 = defineDataSchema({"type_key": "era.tavern.regex.read.result", "representation": "json", "display_name": "ERA·酒馆·正则·读取·结果", "description": "定义“ERA·酒馆·正则·读取·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema182 = defineDataSchema({"type_key": "era.tavern.regex.upsert.request", "representation": "json", "display_name": "ERA·酒馆·正则·幂等写入·请求", "description": "定义“ERA·酒馆·正则·幂等写入·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema183 = defineDataSchema({"type_key": "era.tavern.regex.upsert.result", "representation": "json", "display_name": "ERA·酒馆·正则·幂等写入·结果", "description": "定义“ERA·酒馆·正则·幂等写入·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema184 = defineDataSchema({
  "type_key": "era.tavern.sidecar.clear_prompt.request",
  "representation": "json",
  "display_name": "独立状态文件 弹窗清理请求",
  "description": "清理当前 Sidecar 弹窗。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "expectedSidecarId": {"type": ["string", "null"]},
      "sourceBasis": {
        "type": "object",
        "additionalProperties": false,
        "required": ["identity", "messages"],
        "properties": {
          "identity": {"type": "object", "additionalProperties": false, "required": ["characterId", "chatId", "groupId"], "properties": {"characterId": {"type": ["string", "null"]}, "chatId": {"type": "string"}, "groupId": {"type": ["string", "null"]}}},
          "messages": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}}
        }
      }
    }
  }
});

export const schema185 = defineDataSchema({"type_key": "era.tavern.sidecar.clear_prompt.result", "representation": "json", "display_name": "独立状态文件 弹窗清理结果", "description": "弹窗清理结论。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema186 = defineDataSchema({
  "type_key": "era.tavern.sidecar.commit_metadata.request",
  "representation": "json",
  "display_name": "独立状态文件 指针提交请求",
  "description": "只提交 ERAMetaData.SidecarId；可在已确认文件提交后携带易失快照。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["sidecarId"],
    "properties": {
      "sidecarId": {"type": "string"},
      "notifySubscribers": {"type": "boolean", "description": "false 仅更新已保存块的即时读取缓存；消息完成时通知订阅者，默认 true。"},
      "snapshot": {"type": "object"},
      "workingVersion": {"type": "integer", "minimum": 0, "description": "本次保存对应的内存版本；版本已推进时不得用旧保存结果覆盖读取快照。"},
      "sourceBasis": {
        "type": "object",
        "additionalProperties": false,
        "required": ["identity", "messages"],
        "properties": {
          "identity": {"type": "object", "additionalProperties": false, "required": ["characterId", "chatId", "groupId"], "properties": {"characterId": {"type": ["string", "null"]}, "chatId": {"type": "string"}, "groupId": {"type": ["string", "null"]}}},
          "messages": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}}
        }
      },
      "expectedSidecarId": {"type": ["string", "null"]}
    },
    "additionalProperties": false
  }
});

export const schema187 = defineDataSchema({"type_key": "era.tavern.sidecar.commit_metadata.result", "representation": "json", "display_name": "独立状态文件 元数据提交结果", "description": "聊天元数据提交后的回读。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema188 = defineDataSchema({"type_key": "era.tavern.sidecar.create_id.request", "representation": "json", "display_name": "独立状态文件 ID 创建请求", "description": "创建稳定随机 SidecarId。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": false}});

export const schema189 = defineDataSchema({"type_key": "era.tavern.sidecar.create_id.result", "representation": "json", "display_name": "独立状态文件 ID 创建结果", "description": "新建的稳定 SidecarId。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["sidecarId"], "properties": {"sidecarId": {"type": "string"}}, "additionalProperties": false}});

export const schema190 = defineDataSchema({"type_key": "era.tavern.sidecar.present_prompt.request", "representation": "json", "display_name": "独立状态文件 弹窗请求", "description": "显示 workflow 已确定的不可关闭选择弹窗。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["prompt"], "properties": {"prompt": {"type": "object"}}, "additionalProperties": false}});

export const schema191 = defineDataSchema({"type_key": "era.tavern.sidecar.present_prompt.result", "representation": "json", "display_name": "独立状态文件 弹窗结果", "description": "弹窗发布结论。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema192 = defineDataSchema({"type_key": "era.tavern.sidecar.read_current.request", "representation": "json", "display_name": "独立状态文件 当前上下文读取请求", "description": "读取当前角色、聊天和变量。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": false}});

export const schema193 = defineDataSchema({"type_key": "era.tavern.sidecar.read_current.result", "representation": "json", "display_name": "独立状态文件 当前上下文读取结果", "description": "当前身份、元数据和变量快照。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema194 = defineDataSchema({"type_key": "era.tavern.sidecar.read_record.request", "representation": "json", "display_name": "独立状态文件 记录读取请求", "description": "按稳定 SidecarId 读取当前用户 files 记录。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["sidecarId"], "properties": {"sidecarId": {"type": "string"}}, "additionalProperties": false}});

export const schema195 = defineDataSchema({"type_key": "era.tavern.sidecar.read_record.result", "representation": "json", "display_name": "独立状态文件 记录读取结果", "description": "当前用户 files 中的受控记录。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema196 = defineDataSchema({
  "type_key": "era.tavern.sidecar.write_record.request",
  "representation": "json",
  "display_name": "独立状态文件 记录写入请求",
  "description": "写入版本化当前用户 files 记录。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["sidecarId", "record"],
    "properties": {
      "sidecarId": {"type": "string"},
      "record": {"type": "object"},
      "sourceBasis": {
        "type": "object",
        "additionalProperties": false,
        "required": ["identity", "messages"],
        "properties": {
          "identity": {"type": "object", "additionalProperties": false, "required": ["characterId", "chatId", "groupId"], "properties": {"characterId": {"type": ["string", "null"]}, "chatId": {"type": "string"}, "groupId": {"type": ["string", "null"]}}},
          "messages": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}}
        }
      },
      "expectedSidecarId": {"type": ["string", "null"]}
    },
    "additionalProperties": false
  }
});

export const schema197 = defineDataSchema({"type_key": "era.tavern.sidecar.write_record.result", "representation": "json", "display_name": "独立状态文件 记录写入结果", "description": "受控文件写入结论。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema198 = defineDataSchema({"type_key": "era.tavern.startup_gate.result", "representation": "json", "display_name": "是否启用本次页面服务", "description": "Host 对 workflow 启动决议的机械执行结果。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["activated"], "properties": {"activated": {"type": "boolean"}}, "additionalProperties": false}});

export const schema199 = defineDataSchema({"type_key": "era.tavern.variables.commit.request", "representation": "json", "display_name": "ERA·酒馆·变量·提交·请求", "description": "定义“ERA·酒馆·变量·提交·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema200 = defineDataSchema({"type_key": "era.tavern.variables.commit.result", "representation": "json", "display_name": "ERA·酒馆·变量·提交·结果", "description": "定义“ERA·酒馆·变量·提交·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema201 = defineDataSchema({"type_key": "era.tavern.variables.read.request", "representation": "json", "display_name": "ERA·酒馆·变量·读取·请求", "description": "定义“ERA·酒馆·变量·读取·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema202 = defineDataSchema({"type_key": "era.tavern.variables.read.result", "representation": "json", "display_name": "ERA·酒馆·变量·读取·结果", "description": "定义“ERA·酒馆·变量·读取·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema203 = defineDataSchema({"type_key": "era.tavern.worldbook.bind.request", "representation": "json", "display_name": "ERA·酒馆·世界书·绑定·请求", "description": "定义“ERA·酒馆·世界书·绑定·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema204 = defineDataSchema({"type_key": "era.tavern.worldbook.bind.result", "representation": "json", "display_name": "ERA·酒馆·世界书·绑定·结果", "description": "定义“ERA·酒馆·世界书·绑定·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema205 = defineDataSchema({"type_key": "era.tavern.worldbook.create.request", "representation": "json", "display_name": "ERA·酒馆·世界书·创建·请求", "description": "定义“ERA·酒馆·世界书·创建·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema206 = defineDataSchema({"type_key": "era.tavern.worldbook.create.result", "representation": "json", "display_name": "ERA·酒馆·世界书·创建·结果", "description": "定义“ERA·酒馆·世界书·创建·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema207 = defineDataSchema({"type_key": "era.tavern.worldbook.read.request", "representation": "json", "display_name": "ERA·酒馆·世界书·读取·请求", "description": "定义“ERA·酒馆·世界书·读取·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema208 = defineDataSchema({"type_key": "era.tavern.worldbook.read.result", "representation": "json", "display_name": "ERA·酒馆·世界书·读取·结果", "description": "定义“ERA·酒馆·世界书·读取·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema209 = defineDataSchema({"type_key": "era.tavern.worldbook.replace_entries.request", "representation": "json", "display_name": "ERA·酒馆·世界书·替换·条目·请求", "description": "定义“ERA·酒馆·世界书·替换·条目·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema210 = defineDataSchema({"type_key": "era.tavern.worldbook.replace_entries.result", "representation": "json", "display_name": "ERA·酒馆·世界书·替换·条目·结果", "description": "定义“ERA·酒馆·世界书·替换·条目·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema211 = defineDataSchema({
  "type_key": "era.transport.event.raw",
  "representation": "json",
  "display_name": "ERA 传输原始事件",
  "description": "宿主送入服务 Port 的完整带标签事件；定时器来源只能使用内部收集定时器类型。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
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
});

export const schema212 = defineDataSchema({
  "type_key": "era.transport.event",
  "representation": "json",
  "display_name": "ERA 已校验传输事件",
  "description": "通过结构、序号、字节与参数标签校验后的完整事件。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
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
});

export const schema213 = defineDataSchema({"type_key": "era.workbench.baseline", "representation": "json", "description": "保存当前 Sidecar 记录、聊天身份及读取失败事实，供草稿校验使用。", "schema": {"type": "object", "properties": {"inspected": {"type": "object", "additionalProperties": true}, "current": {"type": ["object", "null"], "additionalProperties": true}, "record": {"type": ["object", "null"], "additionalProperties": true}, "error": {"type": ["object", "null"], "additionalProperties": true}}, "required": ["inspected", "current", "record", "error"], "additionalProperties": false}, "display_name": "工作台当前基准"});

export const schema214 = defineDataSchema({"type_key": "era.workbench.draft", "representation": "json", "description": "汇集用户编辑意图、已读取的基准及校验错误。", "schema": {"type": "object", "properties": {"inspected": {"type": "object", "additionalProperties": true}, "baseline": {"type": "object", "additionalProperties": true}, "request": {"type": "object", "additionalProperties": true}, "error": {"type": ["object", "null"], "additionalProperties": true}}, "required": ["inspected", "baseline", "request", "error"], "additionalProperties": false}, "display_name": "工作台编辑草稿"});

export const schema215 = defineDataSchema({"type_key": "era.workbench.kind", "representation": "json", "description": "区分变量、函数、有序操作与失败分支。", "schema": {"type": "string", "enum": ["variable", "function", "ordered", "failed"]}, "display_name": "工作台编辑类型"});

export const schema216 = defineDataSchema({
  "type_key": "era.workbench.operation_plan",
  "representation": "json",
  "description": "保存按草稿差异生成的有序操作和实际变更。",
  "schema": {
    "type": "object",
    "properties": {"draft": {"type": "object", "additionalProperties": true}, "operations": {"type": "array", "items": {"type": "object", "additionalProperties": true}}, "changes": {"type": "array", "items": {"type": "object", "properties": {"domain": {"enum": ["variable", "function"]}, "kind": {"enum": ["insert", "edit", "delete"]}, "path": {"type": "array", "items": {"type": "string"}}, "name": {"type": "string"}}, "required": ["domain", "kind"], "additionalProperties": false}}, "error": {"type": ["object", "null"], "additionalProperties": true}},
    "required": ["draft", "operations", "changes", "error"],
    "additionalProperties": false
  },
  "display_name": "工作台操作计划"
});

export const schema217 = defineDataSchema({"type_key": "era.workbench.preparation_result", "representation": "json", "description": "保存准备成功的提交上下文，或失败原因。", "schema": {"type": "object", "properties": {"route": {"enum": ["ready", "failed"]}, "inspected": {"type": "object", "additionalProperties": true}, "failure": {"type": "object", "additionalProperties": true}}, "required": ["route", "inspected", "failure"], "additionalProperties": false}, "display_name": "工作台准备结果"});

export const schema218 = defineDataSchema({"type_key": "era.workbench.preparation_route", "representation": "json", "description": "区分继续通用提交校验与返回准备失败。", "schema": {"type": "string", "enum": ["ready", "failed"]}, "display_name": "工作台准备分支"});

export const schema219 = defineDataSchema({"type_key": "era.workbench.request_kind", "representation": "json", "description": "区分普通有序操作请求与内部草稿提交请求。", "schema": {"type": "string", "enum": ["operations", "draft"]}, "display_name": "工作台请求类型"});

export const schema220 = defineDataSchema({"type_key": "era.working.request", "representation": "json", "display_name": "内存变量和函数读取请求", "description": "Service拥有的工作状态及机械读写事实。", "schema": {"type": "object", "additionalProperties": true}});

export const schema221 = defineDataSchema({"type_key": "era.working.result", "representation": "json", "display_name": "当前内存变量和函数", "description": "Service拥有的工作状态及机械读写事实。", "schema": {"type": "object", "additionalProperties": true}});

export const schema222 = defineDataSchema({"type_key": "era.agent.candidate.state.selected", "display_name": "选定入口的本次模型尝试的请求、起点和进度", "representation": "json", "schema": {"anyOf": [{"type": "object", "additionalProperties": false, "required": ["request", "step", "executionState"], "properties": {"request": {"type": "object", "additionalProperties": true}, "step": {"type": "object", "additionalProperties": true}, "executionState": {"type": "object", "additionalProperties": true}}}, {"type": "null"}]}, "description": "执行入口选中时携带真实请求或结果，其他入口为 null；实际入口沿用原请求合同。"});

export const schema223 = defineDataSchema({"type_key": "era.api.request.selected", "representation": "json", "display_name": "选定入口的ERA 公共对象请求", "description": "执行入口选中时携带真实请求或结果，其他入口为 null；实际入口沿用原请求合同。", "schema": {"anyOf": [{"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["task", "sources"], "properties": {"task": {"type": "object"}, "sources": {"type": "array", "minItems": 1, "maxItems": 128, "items": {"type": "object"}}, "dispatchContext": {}, "detail": {"type": "object"}}, "additionalProperties": false}, {"type": "null"}]}});

export const schema224 = defineDataSchema({"type_key": "era.task.execution.result.selected", "representation": "json", "display_name": "选定入口的核心执行结果与原任务", "description": "执行入口选中时携带真实请求或结果，其他入口为 null；实际入口沿用原请求合同。", "schema": {"anyOf": [{"type": "object", "properties": {"kind": {"type": "string", "enum": ["sync", "commit", "direct", "update-mk"]}, "value": {"type": "object"}, "continuation": {"type": "object"}}, "required": ["kind", "value", "continuation"], "additionalProperties": false}, {"type": "null"}]}});

export const schema225 = defineDataSchema({"type_key": "era.task.route.selected", "representation": "json", "display_name": "选定入口的ERA 任务路由", "description": "执行入口选中时携带真实请求或结果，其他入口为 null；实际入口沿用原请求合同。", "schema": {"anyOf": [{"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["initialize", "sync", "api", "update-mk", "agent-generation-session", "ignore", "agent-settings"]}, {"type": "null"}]}});
