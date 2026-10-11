import {defineDataSchema} from "@vibeflow/plugin";

export const schema125 = defineDataSchema({
  "type_key": "era.step.request",
  "representation": "json",
  "display_name": "ERA 步骤请求",
  "description": "按批次索引选择的一个有界动态步骤。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "oneOf": [
      {
        "type": "object",
        "properties": {
          "kind": {"const": "execute"},
          "stepId": {"type": "string", "minLength": 1},
          "index": {"type": "integer", "minimum": 0, "maximum": 127},
          "sourceSequences": {"type": "array", "minItems": 1, "maxItems": 128, "items": {"type": "integer", "minimum": 1}},
          "events": {
            "type": "array",
            "minItems": 1,
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
          "taskRoute": {"type": "string", "enum": ["initialize", "sync", "api", "update-mk", "agent-generation-session"]},
          "task": {
            "oneOf": [
              {
                "type": "object",
                "properties": {
                  "id": {"type": "string", "minLength": 1},
                  "sourceEvents": {
                    "type": "array",
                    "minItems": 1,
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
                  "primaryEvent": {
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
                  },
                  "context": {"type": "string", "enum": ["none", "latest-message", "latest-message-with-mk"]},
                  "kind": {"const": "initialize"},
                  "operation": {"type": "string", "enum": ["startup", "resources", "settings-update"]},
                  "args": {"type": "array", "items": {"oneOf": [{"type": "object", "properties": {"kind": {"const": "json"}, "value": {}}, "required": ["kind", "value"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "undefined"}}, "required": ["kind"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "host-ref"}, "token": {"type": "string", "minLength": 1}, "refKind": {"type": "string", "minLength": 1}}, "required": ["kind", "token", "refKind"], "additionalProperties": false}]}}
                },
                "required": ["id", "sourceEvents", "primaryEvent", "context", "kind", "operation", "args"],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "id": {"type": "string", "minLength": 1},
                  "sourceEvents": {
                    "type": "array",
                    "minItems": 1,
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
                  "primaryEvent": {
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
                  },
                  "context": {"type": "string", "enum": ["none", "latest-message", "latest-message-with-mk"]},
                  "kind": {"const": "sync"},
                  "reason": {"type": "string", "enum": ["history-changed", "edited", "swipe-regeneration", "manual", "facade-commit"]},
                  "target": {"oneOf": [{"type": "object", "properties": {"kind": {"const": "auto"}}, "required": ["kind"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "message"}, "messageId": {"type": "integer", "minimum": 0}, "stopAfterTarget": {"type": "boolean"}}, "required": ["kind", "messageId", "stopAfterTarget"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "previous-of-latest"}, "stopAfterTarget": {"const": true}}, "required": ["kind", "stopAfterTarget"], "additionalProperties": false}]},
                  "fullRebuild": {"type": "boolean"}
                },
                "required": ["id", "sourceEvents", "primaryEvent", "context", "kind", "reason", "target", "fullRebuild"],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "id": {"type": "string", "minLength": 1},
                  "sourceEvents": {
                    "type": "array",
                    "minItems": 1,
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
                  "primaryEvent": {
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
                  },
                  "context": {"type": "string", "enum": ["none", "latest-message", "latest-message-with-mk"]},
                  "kind": {"const": "api"},
                  "intent": {"type": "string", "enum": ["query", "message-write", "state-sync"]},
                  "eventType": {"type": "string", "minLength": 1},
                  "args": {"type": "array", "items": {"oneOf": [{"type": "object", "properties": {"kind": {"const": "json"}, "value": {}}, "required": ["kind", "value"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "undefined"}}, "required": ["kind"], "additionalProperties": false}, {"type": "object", "properties": {"kind": {"const": "host-ref"}, "token": {"type": "string", "minLength": 1}, "refKind": {"type": "string", "minLength": 1}}, "required": ["kind", "token", "refKind"], "additionalProperties": false}]}}
                },
                "required": ["id", "sourceEvents", "primaryEvent", "context", "kind", "intent", "eventType", "args"],
                "additionalProperties": false
              },
              {
                "type": "object",
                "properties": {
                  "id": {"type": "string", "minLength": 1},
                  "sourceEvents": {
                    "type": "array",
                    "minItems": 1,
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
                  "primaryEvent": {
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
                  },
                  "context": {"type": "string", "enum": ["none", "latest-message", "latest-message-with-mk"]},
                  "kind": {"const": "update-mk"}
                },
                "required": ["id", "sourceEvents", "primaryEvent", "context", "kind"],
                "additionalProperties": false
              }
            ]
          },
          "sources": {
            "type": "array",
            "minItems": 1,
            "maxItems": 128,
            "items": {
              "type": "object",
              "properties": {
                "event": {
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
                },
                "relation": {"type": "string", "enum": ["primary", "combined", "coalesced"]}
              },
              "required": ["event", "relation"],
              "additionalProperties": false
            }
          }
        },
        "required": ["kind", "stepId", "index", "taskRoute", "sourceSequences", "events", "task", "sources"],
        "additionalProperties": false
      },
      {
        "type": "object",
        "properties": {
          "kind": {"const": "ignore"},
          "stepId": {"type": "string", "minLength": 1},
          "index": {"type": "integer", "minimum": 0, "maximum": 127},
          "sourceSequences": {"type": "array", "minItems": 1, "maxItems": 128, "items": {"type": "integer", "minimum": 1}},
          "events": {
            "type": "array",
            "minItems": 1,
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
          "taskRoute": {"const": "ignore"},
          "reason": {"type": "string", "minLength": 1}
        },
        "required": ["kind", "stepId", "index", "taskRoute", "sourceSequences", "events", "reason"],
        "additionalProperties": false
      }
    ]
  }
});

export const schema126 = defineDataSchema({"type_key": "era.sync.author.call.route", "representation": "json", "display_name": "作者调用解析结论", "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。", "schema": {"type": "string", "enum": ["valid", "invalid"]}});

export const schema127 = defineDataSchema({"type_key": "era.sync.author.event.action", "display_name": "作者函数接下来要处理的事件", "representation": "json", "schema": {"type": "string", "enum": ["commit", "unsupported", "done", "failed", "complete"]}});

export const schema128 = defineDataSchema({"type_key": "era.sync.author.lifecycle.route", "representation": "json", "display_name": "作者函数本次应启动、等待或收尾", "description": "记录正文作者函数本次应启动、确认提交、等待请求还是结束，供作者调用流程选择下一步。", "schema": {"type": "string", "enum": ["terminal", "start", "wait"]}});

export const schema129 = defineDataSchema({"type_key": "era.sync.author.state", "representation": "json", "display_name": "作者函数处理中的位置工作状态", "description": "作者函数启动、等待、请求分类和确认过程中的私有位置状态；与交回消息块循环的最终位置分开，只有本次处理结束时才交还。", "schema": {"type": "object", "properties": {"state": {"type": "object"}, "position": {"type": ["object", "null"]}, "incomingFunctionEvent": {"type": ["object", "null"]}, "failure": {"type": ["object", "null"]}, "consumedSource": {"type": "boolean"}, "diagnosticsBefore": {"type": "integer"}}, "required": ["state", "consumedSource", "diagnosticsBefore"], "additionalProperties": false}});

export const schema130 = defineDataSchema({"type_key": "era.sync.block.step.pending", "representation": "json", "display_name": "ERA·同步·块步进状态·待提交", "description": "保存处理结束后的消息修改、独立状态文件候选及原任务资料，供统一保存。", "schema": {"type": "object", "properties": {"work": {"type": "object"}, "done": {"type": "boolean"}, "sourceBasis": {"type": ["object", "null"]}, "apiContext": {"type": "object"}, "functionFrame": {"type": ["object", "null"]}, "scopeWindow": {"type": "object"}, "stageOutcome": {"type": "object"}}, "required": ["work", "done", "sourceBasis"], "additionalProperties": false}});

export const schema131 = defineDataSchema({"type_key": "era.sync.block.step.state.next", "representation": "json", "display_name": "ERA·同步·块步进状态·下一个", "description": "保存一次正文处理后的消息位置、变量、函数和日志，并携带后续待处理内容。", "schema": {"type": "object", "properties": {"work": {"type": "object"}, "done": {"type": "boolean"}, "sourceBasis": {"type": ["object", "null"]}, "apiContext": {"type": "object"}, "functionFrame": {"type": ["object", "null"]}, "scopeWindow": {"type": "object"}, "stageOutcome": {"type": "object"}}, "required": ["work", "done", "sourceBasis"], "additionalProperties": false}});

export const schema132 = defineDataSchema({"type_key": "era.sync.block.step.state", "representation": "json", "display_name": "ERA·同步·块步进状态", "description": "保存本次消息范围、当前处理位置、变量、函数、日志及待保存正文，供消息循环继续处理。", "schema": {"type": "object", "properties": {"work": {"type": "object"}, "done": {"type": "boolean"}, "sourceBasis": {"type": ["object", "null"]}, "apiContext": {"type": "object"}, "functionFrame": {"type": ["object", "null"]}, "scopeWindow": {"type": "object"}, "stageOutcome": {"type": "object"}}, "required": ["work", "done", "sourceBasis"], "additionalProperties": false}});
