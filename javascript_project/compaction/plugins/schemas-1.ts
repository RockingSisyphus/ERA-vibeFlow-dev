import {defineDataSchema} from "@vibeflow/plugin";

export const schema0 = defineDataSchema({
  "type_key": "era.command_compaction.candidate",
  "representation": "json",
  "display_name": "压缩候选",
  "description": "保留原命令残余与局部规范标签组成的候选消息。",
  "schema": {
    "type": "object",
    "additionalProperties": true
  }
});

export const schema1 = defineDataSchema({
  "type_key": "era.command_compaction.invariants",
  "representation": "json",
  "display_name": "重放不变量",
  "description": "用于判断任意可达历史起点下安全重写的保守条件。",
  "schema": {
    "type": "object",
    "additionalProperties": true
  }
});

export const schema2 = defineDataSchema({
  "type_key": "era.command_compaction.parsed",
  "representation": "json",
  "display_name": "已解析命令层",
  "description": "按原文位置排序的六类 ERA 指令和保留文本区间。",
  "schema": {
    "type": "object",
    "additionalProperties": true
  }
});

export const schema3 = defineDataSchema({
  "type_key": "era.command_compaction.regions",
  "representation": "json",
  "display_name": "安全压缩区间",
  "description": "可改写区间与不可跨越的语义屏障。",
  "schema": {
    "type": "object",
    "additionalProperties": true
  }
});

export const schema4 = defineDataSchema({
  "type_key": "era.command_compaction.request",
  "representation": "json",
  "display_name": "ERA 命令层压缩请求",
  "description": "一条消息文本及该层起始变量、函数、元数据和模板上下文。",
  "schema": {
    "type": "object",
    "additionalProperties": true
  }
});

export const schema5 = defineDataSchema({
  "type_key": "era.command_compaction.response",
  "representation": "json",
  "display_name": "ERA 命令层压缩结果",
  "description": "规范消息、压缩状态、未压缩原因、最终状态、函数库和诊断。",
  "schema": {
    "type": "object",
    "additionalProperties": true
  }
});

export const schema6 = defineDataSchema({
  "type_key": "era.command_compaction.segment.done",
  "representation": "json",
  "display_name": "全部分段处理完成",
  "description": "表示当前游标是否已处理完所有分段，供循环判断是否结束。",
  "schema": {
    "type": "boolean"
  }
});

export const schema7 = defineDataSchema({
  "type_key": "era.command_compaction.segment.state.before",
  "representation": "json",
  "display_name": "本段起始压缩状态",
  "description": "本段执行前状态，仅供段结束时推进游标；与循环下一状态分离。",
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
