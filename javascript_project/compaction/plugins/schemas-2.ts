import {defineDataSchema} from "@vibeflow/plugin";

export const schema8 = defineDataSchema({
  "type_key": "era.command_compaction.segment.state",
  "representation": "json",
  "display_name": "按顺序继承的分段压缩状态",
  "description": "顺序分段循环的当前状态；含游标、层请求、段列表和累计结果。",
  "schema": {
    "type": "object",
    "required": [
      "cursor",
      "segments",
      "request",
      "statData",
      "statFunc",
      "drawOffset",
      "parts",
      "diagnostics",
      "reasons"
    ],
    "properties": {
      "cursor": {
        "type": "integer"
      },
      "segments": {
        "type": "array"
      },
      "request": {
        "type": "object"
      },
      "statData": {
        "type": "object"
      },
      "statFunc": {
        "type": "object"
      },
      "drawOffset": {
        "type": "integer"
      },
      "parts": {
        "type": "array"
      },
      "diagnostics": {
        "type": "array"
      },
      "reasons": {
        "type": "array"
      }
    },
    "additionalProperties": true
  }
});

export const schema9 = defineDataSchema({
  "type_key": "era.command_compaction.semantic_trace",
  "representation": "json",
  "display_name": "原始语义轨迹",
  "description": "原命令逐步重放后的变量、函数、日志和诊断轨迹。",
  "schema": {
    "type": "object",
    "additionalProperties": true
  }
});

export const schema10 = defineDataSchema({
  "type_key": "era.command_compaction.symbols",
  "representation": "json",
  "display_name": "符号依赖",
  "description": "变量、函数及快照闭包的规范表达式和依赖信息。",
  "schema": {
    "type": "object",
    "additionalProperties": true
  }
});

export const schema11 = defineDataSchema({
  "type_key": "era.command_compaction.verified",
  "representation": "json",
  "display_name": "已验证候选",
  "description": "通过重放与保守等价证明的候选，或退回原命令。",
  "schema": {
    "type": "object",
    "additionalProperties": true
  }
});
