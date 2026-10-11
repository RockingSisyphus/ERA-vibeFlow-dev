import {defineDataSchema} from "@vibeflow/plugin";

export const schema116 = defineDataSchema({
  "type_key": "era.service.state.next",
  "representation": "json",
  "display_name": "ERA 下一服务状态",
  "description": "一次等待或批次处理后交还永久循环的有界状态。",
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

export const schema117 = defineDataSchema({
  "type_key": "era.service.state.post_batch",
  "representation": "json",
  "display_name": "ERA 批次后服务状态",
  "description": "批次收尾并发布出站帧后的有界服务状态。",
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

export const schema118 = defineDataSchema({
  "type_key": "era.service.state",
  "representation": "json",
  "display_name": "ERA 服务状态",
  "description": "永久服务循环携带的有界事件集、定时器与连续 MK 计数状态。",
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

export const schema119 = defineDataSchema({
  "type_key": "era.sidecar.binding.facts",
  "representation": "json",
  "display_name": "独立状态文件 绑定事实",
  "description": "当前身份、聊天 SidecarId、V2 文件记录与仅用于一次迁移的旧状态事实。运行资格由安装作用域 workflow 决定，缺失指针为 create 或 migrate-legacy。",
  "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["status", "reason", "current", "sidecarId", "record", "legacyRecord", "legacyState"], "additionalProperties": false, "properties": {"status": {"type": "string", "enum": ["create", "migrate-legacy", "matched", "conflict", "invalid", "blocked"]}, "reason": {"type": "string"}, "current": {"type": ["object", "null"]}, "sidecarId": {"type": ["string", "null"]}, "record": {"type": ["object", "null"]}, "legacyRecord": {"type": ["object", "null"]}, "legacyState": {"type": ["object", "null"]}}}
});

export const schema120 = defineDataSchema({"type_key": "era.sidecar.binding.input", "representation": "json", "display_name": "独立状态文件 绑定输入", "description": "保存状态文件绑定流程所需的聊天身份、文件资料及同步上下文。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["sync"], "additionalProperties": false, "properties": {"sync": {"type": "object"}}}});

export const schema121 = defineDataSchema({"type_key": "era.sidecar.binding.resolution", "representation": "json", "display_name": "独立状态文件 绑定决议", "description": "纯规则解析出的事实、路由与可选用户选择。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "required": ["facts", "route", "choice"], "additionalProperties": false, "properties": {"facts": {"type": "object"}, "route": {"type": "string", "enum": ["continue", "blocked", "apply"]}, "choice": {"type": ["string", "null"], "enum": ["migrate", "independent", "copy", "repair", null]}}}});

export const schema122 = defineDataSchema({"type_key": "era.sidecar.binding.route", "representation": "json", "display_name": "独立状态文件 绑定路由", "description": "Sidecar 绑定事务的正式条件路由。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["continue", "blocked", "applied"]}});

export const schema123 = defineDataSchema({"type_key": "era.step.done", "representation": "json", "display_name": "ERA·步骤·完成", "description": "定义“ERA·步骤·完成”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "boolean"}});
