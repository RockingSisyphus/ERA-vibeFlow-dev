import {defineDataSchema} from "@vibeflow/plugin";

export const schema8 = defineDataSchema({
  "type_key": "era.expression.function_library.compiled",
  "representation": "json",
  "display_name": "已编译函数库",
  "description": "已通过调用图、纯度、参数与递归验证的函数库。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});

export const schema9 = defineDataSchema({
  "type_key": "era.expression.function_library.dependencies",
  "representation": "json",
  "display_name": "函数调用依赖",
  "description": "从函数体 AST 提取的自定义函数和内建函数调用边。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});

export const schema10 = defineDataSchema({
  "type_key": "era.expression.function_library.parsed",
  "representation": "json",
  "display_name": "已解析函数库",
  "description": "ERA 自有语法解析产生的函数定义 AST 集合。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "array",
    "items": {
      "type": "object"
    }
  }
});

export const schema11 = defineDataSchema({
  "type_key": "era.expression.function_library.purity",
  "representation": "json",
  "display_name": "函数纯度报告",
  "description": "函数体形参、自由变量、调用名称和参数数量验证的结果。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});

export const schema12 = defineDataSchema({
  "type_key": "era.expression.operation.current",
  "representation": "json",
  "display_name": "当前表达式操作",
  "description": "按游标选中的目标路径、原始 AST、当时顺序状态和操作定位信息。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});

export const schema13 = defineDataSchema({
  "type_key": "era.expression.operations.parsed",
  "representation": "json",
  "display_name": "已解析顺序操作",
  "description": "保留消息层顺序的路径与表达式 AST 操作集合。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "array",
    "items": {
      "type": "object"
    }
  }
});

export const schema14 = defineDataSchema({
  "type_key": "era.expression.request.normalized",
  "representation": "json",
  "display_name": "规范表达式请求",
  "description": "经过输入形状与有限数值验证的函数表达式请求。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});

export const schema15 = defineDataSchema({
  "type_key": "era.expression.request",
  "representation": "json",
  "display_name": "函数表达式请求",
  "description": "公共求值入口接受原始输入；由 validate_request 领域节点产生输入诊断，保持 executeExpressionLayer 的 unknown 输入与返回语义。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema"
  }
});
