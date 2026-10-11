import {defineDataSchema} from "@vibeflow/plugin";

export const schema133 = defineDataSchema({
  "type_key": "era.sync.commit.contract.failure",
  "representation": "json",
  "display_name": "ERA·同步·提交·合同·失败",
  "description": "携带无效 processing MK、公开 payload、连续状态或 TaskResult 候选的预提交失败证据；valid 路由下为 null。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": ["object", "null"],
    "additionalProperties": false,
    "required": ["schemaVersion", "step", "failure"],
    "properties": {
      "schemaVersion": {"const": 1},
      "step": {
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
              },
              "dispatchContext": {
                "oneOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["schemaVersion", "status", "dispatchClass", "requirement", "messages", "processingMessage", "processingMk", "messageChanged", "variablesChanged", "failure"],
                    "properties": {
                      "schemaVersion": {"const": 2},
                      "status": {"enum": ["ready", "failed"]},
                      "dispatchClass": {"enum": ["initialize", "sync", "api", "update-mk", "ignore"]},
                      "requirement": {"enum": ["none", "latest-message", "latest-message-with-mk"]},
                      "messages": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}},
                      "messageChanged": {"type": "boolean"},
                      "variablesChanged": {"type": "boolean"},
                      "failure": {"oneOf": [{"type": "null"}, {"type": "object", "additionalProperties": true, "required": ["code", "message", "category", "retryable"], "properties": {"code": {"type": "string", "minLength": 1}, "message": {"type": "string"}, "category": {"enum": ["input", "domain", "tavern", "cancelled"]}, "retryable": {"type": "boolean"}}}]},
                      "processingMessage": {"oneOf": [{"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}, {"type": "null"}]},
                      "processingMk": {"oneOf": [{"type": "string", "minLength": 1}, {"type": "null"}]}
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["schemaVersion", "status", "dispatchClass", "requirement", "messages", "processingMessage", "processingMk", "messageChanged", "variablesChanged", "failure", "generationCycleIdentity", "floorIdentity", "stagedMessageUpdates", "agentFloorCandidate"],
                    "properties": {
                      "schemaVersion": {"const": 3},
                      "status": {"enum": ["ready", "failed"]},
                      "dispatchClass": {"enum": ["initialize", "sync", "api", "update-mk", "ignore"]},
                      "requirement": {"enum": ["none", "latest-message", "latest-message-with-mk"]},
                      "messages": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}},
                      "processingMessage": {"oneOf": [{"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}, {"type": "null"}]},
                      "processingMk": {"oneOf": [{"type": "string", "minLength": 1}, {"type": "null"}]},
                      "messageChanged": {"type": "boolean"},
                      "variablesChanged": {"type": "boolean"},
                      "failure": {"oneOf": [{"type": "null"}, {"type": "object", "additionalProperties": false, "required": ["code", "message", "category", "retryable"], "properties": {"code": {"type": "string", "minLength": 1}, "message": {"type": "string"}, "category": {"enum": ["input", "domain", "tavern", "cancelled"]}, "retryable": {"const": false}, "details": {"type": "object"}}}]},
                      "generationCycleIdentity": {"oneOf": [{"type": "object", "additionalProperties": false, "required": ["chatId", "eventId", "sourceKey"], "properties": {"chatId": {"type": "string", "minLength": 1}, "eventId": {"type": "string", "minLength": 1}, "sourceKey": {"type": "string", "minLength": 1}}}, {"type": "null"}]},
                      "floorIdentity": {"oneOf": [{"type": "object", "additionalProperties": false, "required": ["chatId", "messageId", "swipeId", "mk"], "properties": {"chatId": {"type": "string", "minLength": 1}, "messageId": {"type": "integer", "minimum": 0}, "swipeId": {"type": "integer", "minimum": 0}, "mk": {"type": "string", "minLength": 1}}}, {"type": "null"}]},
                      "stagedMessageUpdates": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["messageId", "content"], "properties": {"messageId": {"type": "integer", "minimum": 0}, "content": {"type": "string"}}}},
                      "sourceBasis": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": ["identity", "messages"],
                        "properties": {
                          "identity": {"type": "object", "additionalProperties": false, "required": ["characterId", "chatId", "groupId"], "properties": {"characterId": {"type": ["string", "null"]}, "chatId": {"type": "string"}, "groupId": {"type": ["string", "null"]}}},
                          "messages": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}}
                        }
                      },
                      "agentFloorCandidate": {"oneOf": [{"type": "object", "additionalProperties": false, "required": ["messageId", "swipeId", "mk", "content", "extra", "terminalStatus", "requiresInitialPresentation"], "properties": {"messageId": {"type": "integer", "minimum": 0}, "swipeId": {"type": "integer", "minimum": 0}, "mk": {"type": "string", "minLength": 1}, "content": {"type": "string"}, "extra": {"type": "object"}, "terminalStatus": {"enum": ["settled", "story-complete", "unsettled"]}, "requiresInitialPresentation": {"type": "boolean"}}}, {"type": "null"}]}
                    }
                  }
                ]
              }
            },
            "required": ["kind", "stepId", "index", "taskRoute", "sourceSequences", "events", "task", "sources", "dispatchContext"],
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
              "reason": {"type": "string", "minLength": 1},
              "dispatchContext": {
                "oneOf": [
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["schemaVersion", "status", "dispatchClass", "requirement", "messages", "processingMessage", "processingMk", "messageChanged", "variablesChanged", "failure"],
                    "properties": {
                      "schemaVersion": {"const": 2},
                      "status": {"enum": ["ready", "failed"]},
                      "dispatchClass": {"enum": ["initialize", "sync", "api", "update-mk", "ignore"]},
                      "requirement": {"enum": ["none", "latest-message", "latest-message-with-mk"]},
                      "messages": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}},
                      "messageChanged": {"type": "boolean"},
                      "variablesChanged": {"type": "boolean"},
                      "failure": {"oneOf": [{"type": "null"}, {"type": "object", "additionalProperties": true, "required": ["code", "message", "category", "retryable"], "properties": {"code": {"type": "string", "minLength": 1}, "message": {"type": "string"}, "category": {"enum": ["input", "domain", "tavern", "cancelled"]}, "retryable": {"type": "boolean"}}}]},
                      "processingMessage": {"oneOf": [{"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}, {"type": "null"}]},
                      "processingMk": {"oneOf": [{"type": "string", "minLength": 1}, {"type": "null"}]}
                    }
                  },
                  {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["schemaVersion", "status", "dispatchClass", "requirement", "messages", "processingMessage", "processingMk", "messageChanged", "variablesChanged", "failure", "generationCycleIdentity", "floorIdentity", "stagedMessageUpdates", "agentFloorCandidate"],
                    "properties": {
                      "schemaVersion": {"const": 3},
                      "status": {"enum": ["ready", "failed"]},
                      "dispatchClass": {"enum": ["initialize", "sync", "api", "update-mk", "ignore"]},
                      "requirement": {"enum": ["none", "latest-message", "latest-message-with-mk"]},
                      "messages": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}},
                      "processingMessage": {"oneOf": [{"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}, {"type": "null"}]},
                      "processingMk": {"oneOf": [{"type": "string", "minLength": 1}, {"type": "null"}]},
                      "messageChanged": {"type": "boolean"},
                      "variablesChanged": {"type": "boolean"},
                      "failure": {"oneOf": [{"type": "null"}, {"type": "object", "additionalProperties": false, "required": ["code", "message", "category", "retryable"], "properties": {"code": {"type": "string", "minLength": 1}, "message": {"type": "string"}, "category": {"enum": ["input", "domain", "tavern", "cancelled"]}, "retryable": {"const": false}, "details": {"type": "object"}}}]},
                      "generationCycleIdentity": {"oneOf": [{"type": "object", "additionalProperties": false, "required": ["chatId", "eventId", "sourceKey"], "properties": {"chatId": {"type": "string", "minLength": 1}, "eventId": {"type": "string", "minLength": 1}, "sourceKey": {"type": "string", "minLength": 1}}}, {"type": "null"}]},
                      "floorIdentity": {"oneOf": [{"type": "object", "additionalProperties": false, "required": ["chatId", "messageId", "swipeId", "mk"], "properties": {"chatId": {"type": "string", "minLength": 1}, "messageId": {"type": "integer", "minimum": 0}, "swipeId": {"type": "integer", "minimum": 0}, "mk": {"type": "string", "minLength": 1}}}, {"type": "null"}]},
                      "stagedMessageUpdates": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["messageId", "content"], "properties": {"messageId": {"type": "integer", "minimum": 0}, "content": {"type": "string"}}}},
                      "sourceBasis": {
                        "type": "object",
                        "additionalProperties": false,
                        "required": ["identity", "messages"],
                        "properties": {
                          "identity": {"type": "object", "additionalProperties": false, "required": ["characterId", "chatId", "groupId"], "properties": {"characterId": {"type": ["string", "null"]}, "chatId": {"type": "string"}, "groupId": {"type": ["string", "null"]}}},
                          "messages": {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["schemaVersion", "messageId", "role", "activeText", "swipeIndex"], "properties": {"schemaVersion": {"const": 1}, "messageId": {"type": "integer", "minimum": 0}, "role": {"type": "string", "minLength": 1}, "activeText": {"type": "string"}, "swipeIndex": {"oneOf": [{"type": "integer", "minimum": 0}, {"type": "null"}]}}}}
                        }
                      },
                      "agentFloorCandidate": {"oneOf": [{"type": "object", "additionalProperties": false, "required": ["messageId", "swipeId", "mk", "content", "extra", "terminalStatus", "requiresInitialPresentation"], "properties": {"messageId": {"type": "integer", "minimum": 0}, "swipeId": {"type": "integer", "minimum": 0}, "mk": {"type": "string", "minLength": 1}, "content": {"type": "string"}, "extra": {"type": "object"}, "terminalStatus": {"enum": ["settled", "story-complete", "unsettled"]}, "requiresInitialPresentation": {"type": "boolean"}}}, {"type": "null"}]}
                    }
                  }
                ]
              }
            },
            "required": ["kind", "stepId", "index", "taskRoute", "sourceSequences", "events", "reason", "dispatchContext"],
            "additionalProperties": false
          }
        ]
      },
      "failure": {"type": "object", "properties": {"code": {"type": "string", "minLength": 1}, "message": {"type": "string"}, "category": {"type": "string", "enum": ["input", "domain", "tavern", "cancelled"]}, "retryable": {"type": "boolean"}, "details": {"type": "object", "additionalProperties": true}}, "required": ["code", "message", "category", "retryable"], "additionalProperties": false}
    }
  }
});

export const schema134 = defineDataSchema({"type_key": "era.sync.commit.validation.route", "representation": "json", "display_name": "ERA·同步·提交·校验·路由", "description": "区分同步提交候选合同有效，或必须在任何 Capability 写入前按失败结束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["valid", "failed"]}});

export const schema135 = defineDataSchema({"type_key": "era.sync.context", "representation": "json", "display_name": "ERA·同步·上下文", "description": "定义“ERA·同步·上下文”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema136 = defineDataSchema({"type_key": "era.sync.crud.request", "representation": "json", "display_name": "ERA·同步·变量增删改·请求", "description": "定义“ERA·同步·CRUD·请求”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema137 = defineDataSchema({"type_key": "era.sync.floor.origin.route", "representation": "json", "display_name": "当前楼层准备结论", "description": "记录当前消息的历史标识及起点准备是否有效，选择继续处理、跳过消息或结束范围。", "schema": {"type": "string", "enum": ["invalid", "ready"]}});

export const schema138 = defineDataSchema({"type_key": "era.sync.function.commit.route", "representation": "json", "display_name": "作者函数提交结论", "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。", "schema": {"type": "string", "enum": ["immediate", "apply", "failed"]}});

export const schema139 = defineDataSchema({"type_key": "era.sync.function.effect.route", "representation": "json", "display_name": "作者宿主动作实际结果", "description": "仅在当前作者函数步进选择实际完成或原错误清理；不增加新的业务准入。", "schema": {"type": "string", "enum": ["ok", "failed"]}});

export const schema140 = defineDataSchema({"type_key": "era.sync.function.event.route", "representation": "json", "display_name": "作者函数等待事件", "description": "记录作者函数返回的是变量提交、历史同步请求、正常结束还是错误，供调用流程选择处理方式。", "schema": {"type": "string", "enum": ["done", "commit", "unsupported", "failed"]}});

export const schema141 = defineDataSchema({"type_key": "era.sync.function.invocation.route", "representation": "json", "display_name": "ERA·同步·函数调用路由", "description": "历史预留的函数调用路由枚举；当前 Service 工作流没有引用它，函数调用由共用块执行流程处理。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "string", "enum": ["none", "invoke"]}});

export const schema142 = defineDataSchema({"type_key": "era.sync.logical_result", "representation": "json", "display_name": "ERA·同步·逻辑·结果", "description": "定义“ERA·同步·逻辑·结果”的数据结构与校验约束。", "schema": {"$schema": "https://json-schema.org/draft/2020-12/schema", "type": "object", "additionalProperties": true}});

export const schema143 = defineDataSchema({"type_key": "era.sync.message.action.route", "display_name": "当前消息片段的处理动作", "representation": "json", "schema": {"type": "string", "enum": ["author", "operations", "author-call", "skip", "message-end", "complete"]}});

export const schema144 = defineDataSchema({"type_key": "era.sync.operation.origin.route", "representation": "json", "display_name": "结果来自正文指令或生成阶段函数清单", "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。", "schema": {"type": "string", "enum": ["command", "stage-calls"]}});

export const schema145 = defineDataSchema({"type_key": "era.sync.position.lifecycle.route", "representation": "json", "display_name": "消息位置生命周期", "description": "由对应判断节点按当前事实产生，仅选择本次实际控制分支，不改变业务结果。", "schema": {"type": "string", "enum": ["terminal", "function-start", "function-wait", "source"]}});

export const schema146 = defineDataSchema({"type_key": "era.sync.position.state", "representation": "json", "display_name": "当前位置、变量、函数和待保存正文", "description": "保存当前消息和正文片段位置、变量与函数、历史起点、作者调用进度及失败原因，供逐段处理聊天正文。", "schema": {"type": "object", "properties": {"state": {"type": "object"}, "position": {"type": ["object", "null"]}, "incomingFunctionEvent": {"type": ["object", "null"]}, "failure": {"type": ["object", "null"]}, "consumedSource": {"type": "boolean"}, "diagnosticsBefore": {"type": "integer"}}, "required": ["state", "consumedSource", "diagnosticsBefore"], "additionalProperties": false}});
