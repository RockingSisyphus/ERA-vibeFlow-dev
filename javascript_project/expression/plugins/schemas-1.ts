import {defineDataSchema} from "@vibeflow/plugin";

export const schema0 = defineDataSchema({
  "type_key": "era.expression.ast_frame.current",
  "representation": "json",
  "display_name": "当前 AST 调用帧",
  "description": "栈顶 AST 节点、已完成子值、当前函数局部环境及其父帧位置。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});

export const schema1 = defineDataSchema({
  "type_key": "era.expression.ast_frame.done",
  "representation": "json",
  "display_name": "AST 调用帧结束标记",
  "description": "表示当前根表达式的显式调用帧栈是否已完成。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "boolean"
  }
});

export const schema2 = defineDataSchema({
  "type_key": "era.expression.ast_frame.route",
  "representation": "json",
  "display_name": "AST 调用帧路由",
  "description": "决定将栈顶帧交给值、运算符、内建函数、随机函数、自定义函数或返回处理。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "string",
    "enum": [
      "value",
      "operator",
      "builtin",
      "random",
      "custom",
      "return"
    ]
  }
});

export const schema3 = defineDataSchema({
  "type_key": "era.expression.ast_frame.state",
  "representation": "json",
  "display_name": "AST 调用帧状态",
  "description": "显式后序求值帧栈、当前函数局部环境、父帧接收位置和累积诊断。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});

export const schema4 = defineDataSchema({
  "type_key": "era.expression.ast_frame.transition",
  "representation": "json",
  "display_name": "AST 调用帧迁移",
  "description": "单步帧执行后要压入、弹出或回填的显式栈迁移。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});

export const schema5 = defineDataSchema({
  "type_key": "era.expression.execution.result",
  "representation": "json",
  "display_name": "顺序数值结果",
  "description": "逐条执行后的最终有限数值状态、逐操作结果和诊断。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});

export const schema6 = defineDataSchema({
  "type_key": "era.expression.function_library.acyclic_graph",
  "representation": "json",
  "display_name": "无环函数调用图",
  "description": "经深度优先遍历（DFS）检查的函数调用图，同时保留直接或间接递归的诊断。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});

export const schema7 = defineDataSchema({
  "type_key": "era.expression.function_library.call_graph",
  "representation": "json",
  "display_name": "函数调用图",
  "description": "支持前向定义和嵌套调用的有向自定义函数调用图。",
  "schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "additionalProperties": true
  }
});
