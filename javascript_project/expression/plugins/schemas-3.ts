import {defineDataSchema} from "@vibeflow/plugin";

export const schema16 = defineDataSchema({
  "type_key": "era.expression.response",
  "representation": "json",
  "display_name": "函数表达式结果",
  "description": "独立表达式 root 的最终数值状态、诊断、随机槽位计数和可重放压缩候选。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": [
      "finalState",
      "diagnostics",
      "compactedOperations",
      "randomDrawsConsumed",
      "nextDrawOffset",
      "containsAutomaticRandom"
    ],
    "properties": {
      "finalState": {
        "type": "object"
      },
      "diagnostics": {
        "type": "array"
      },
      "compactedOperations": {
        "type": "array"
      },
      "randomDrawsConsumed": {
        "type": "integer",
        "minimum": 0
      },
      "nextDrawOffset": {
        "type": "integer",
        "minimum": 0
      },
      "containsAutomaticRandom": {
        "type": "boolean"
      }
    },
    "additionalProperties": true
  }
});

export const schema17 = defineDataSchema({
  "type_key": "era.expression.sequence.done",
  "representation": "json",
  "display_name": "顺序操作结束标记",
  "description": "表示操作游标已到达有序操作列表末尾。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "boolean"
  }
});

export const schema18 = defineDataSchema({
  "type_key": "era.expression.sequence.state",
  "representation": "json",
  "display_name": "表达式顺序执行状态",
  "description": "包含层起始状态、当前状态、操作游标、函数库和累计诊断的显式 carry 状态。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});

export const schema19 = defineDataSchema({
  "type_key": "era.expression.symbolic.layer",
  "representation": "json",
  "display_name": "符号层变化",
  "description": "以 @path 表示层开始状态的顺序替换结果。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});

export const schema20 = defineDataSchema({
  "type_key": "era.expression.value",
  "representation": "json",
  "display_name": "表达式数值",
  "description": "表达式求值得到的有限数值或定位诊断的 JSON 结果。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});
