import {defineDataSchema} from "@vibeflow/plugin";

export const schema8 = defineDataSchema({
  "type_key": "era.macro.snapshot",
  "representation": "json",
  "display_name": "宏快照",
  "description": "替换所用的含元数据与不含元数据视图及处理模式，或状态缺失标记。已存状态经反转义生成视图；调用方显式提供的视图直接沿用。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "oneOf": [
      {
        "type": "object",
        "properties": {
          "kind": {
            "const": "present"
          },
          "statWithMeta": {},
          "statWithoutMeta": {},
          "mode": {
            "enum": [
              "raw",
              "lazy"
            ]
          }
        },
        "required": [
          "kind",
          "statWithMeta",
          "statWithoutMeta"
        ],
        "additionalProperties": false
      },
      {
        "type": "object",
        "properties": {
          "kind": {
            "const": "missing"
          },
          "mode": {
            "enum": [
              "raw",
              "lazy"
            ]
          }
        },
        "required": [
          "kind"
        ],
        "additionalProperties": false
      }
    ]
  }
});

export const schema9 = defineDataSchema({
  "type_key": "era.macro.stored_stat",
  "representation": "json",
  "display_name": "已存 ERA 状态",
  "description": "宏处理的公开状态输入：present 表示已存 JSON 状态，missing 表示状态缺失；view 携带调用方选定的两种视图和原始、延迟或提示处理模式；projection-only 表示无快照提示，仅清除技术块。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "oneOf": [
      {
        "type": "object",
        "properties": {
          "kind": {
            "const": "present"
          },
          "value": {}
        },
        "required": [
          "kind",
          "value"
        ],
        "additionalProperties": false
      },
      {
        "type": "object",
        "properties": {
          "kind": {
            "const": "missing"
          }
        },
        "required": [
          "kind"
        ],
        "additionalProperties": false
      },
      {
        "type": "object",
        "properties": {
          "kind": {
            "const": "view"
          },
          "mode": {
            "enum": [
              "raw",
              "lazy",
              "prompt"
            ]
          },
          "statWithMeta": {},
          "statWithoutMeta": {}
        },
        "required": [
          "kind",
          "mode",
          "statWithMeta",
          "statWithoutMeta"
        ],
        "additionalProperties": false
      },
      {
        "type": "object",
        "properties": {
          "kind": {
            "const": "projection-only"
          }
        },
        "required": [
          "kind"
        ],
        "additionalProperties": false
      }
    ]
  }
});

export const schema10 = defineDataSchema({
  "type_key": "era.macro.substring.for_replace",
  "representation": "json",
  "display_name": "待替换文本片段",
  "description": "与稳定快照一同传入替换节点集的已检查原始文本片段。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "string"
  }
});

export const schema11 = defineDataSchema({
  "type_key": "era.macro.substring",
  "representation": "json",
  "display_name": "宏文本片段",
  "description": "由 Tavern 同步宏适配器传入的原始文本片段。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "string"
  }
});
