import {defineDataSchema} from "@vibeflow/plugin";

export const contract_0_0 = defineDataSchema({
  "type_key": "era.expression.ast_frame.current",
  "representation": "json",
  "display_name": "当前 AST 调用帧",
  "description": "栈顶 AST 节点、已完成子值、当前函数局部环境及其父帧位置。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_0_1 = defineDataSchema({
  "type_key": "era.expression.ast_frame.done",
  "representation": "json",
  "display_name": "AST 调用帧结束标记",
  "description": "表示当前根表达式的显式调用帧栈是否已完成。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"boolean"}
});

export const contract_0_2 = defineDataSchema({
  "type_key": "era.expression.ast_frame.route",
  "representation": "json",
  "display_name": "AST 调用帧路由",
  "description": "决定将栈顶帧交给值、运算符、内建函数、随机函数、自定义函数或返回处理。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"string","enum":["value","operator","builtin","random","custom","return"]}
});

export const contract_0_3 = defineDataSchema({
  "type_key": "era.expression.ast_frame.state",
  "representation": "json",
  "display_name": "AST 调用帧状态",
  "description": "显式后序求值帧栈、当前函数局部环境、父帧接收位置和累积诊断。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_0_4 = defineDataSchema({
  "type_key": "era.expression.ast_frame.transition",
  "representation": "json",
  "display_name": "AST 调用帧迁移",
  "description": "单步帧执行后要压入、弹出或回填的显式栈迁移。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_0_5 = defineDataSchema({
  "type_key": "era.expression.execution.result",
  "representation": "json",
  "display_name": "顺序数值结果",
  "description": "逐条执行后的最终有限数值状态、逐操作结果和诊断。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_0_6 = defineDataSchema({
  "type_key": "era.expression.function_library.acyclic_graph",
  "representation": "json",
  "display_name": "无环函数调用图",
  "description": "经深度优先遍历（DFS）检查的函数调用图，同时保留直接或间接递归的诊断。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_0_7 = defineDataSchema({
  "type_key": "era.expression.function_library.call_graph",
  "representation": "json",
  "display_name": "函数调用图",
  "description": "支持前向定义和嵌套调用的有向自定义函数调用图。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_0_8 = defineDataSchema({
  "type_key": "era.expression.function_library.compiled",
  "representation": "json",
  "display_name": "已编译函数库",
  "description": "已通过调用图、纯度、参数与递归验证的函数库。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_0_9 = defineDataSchema({
  "type_key": "era.expression.function_library.dependencies",
  "representation": "json",
  "display_name": "函数调用依赖",
  "description": "从函数体 AST 提取的自定义函数和内建函数调用边。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_0_10 = defineDataSchema({
  "type_key": "era.expression.function_library.parsed",
  "representation": "json",
  "display_name": "已解析函数库",
  "description": "ERA 自有语法解析产生的函数定义 AST 集合。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"array","items":{"type":"object"}}
});

export const contract_0_11 = defineDataSchema({
  "type_key": "era.expression.function_library.purity",
  "representation": "json",
  "display_name": "函数纯度报告",
  "description": "函数体形参、自由变量、调用名称和参数数量验证的结果。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_0_12 = defineDataSchema({
  "type_key": "era.expression.operation.current",
  "representation": "json",
  "display_name": "当前表达式操作",
  "description": "按游标选中的目标路径、原始 AST、当时顺序状态和操作定位信息。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_0_13 = defineDataSchema({
  "type_key": "era.expression.operations.parsed",
  "representation": "json",
  "display_name": "已解析顺序操作",
  "description": "保留消息层顺序的路径与表达式 AST 操作集合。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"array","items":{"type":"object"}}
});

export const contract_0_14 = defineDataSchema({
  "type_key": "era.expression.request.normalized",
  "representation": "json",
  "display_name": "规范表达式请求",
  "description": "经过输入形状与有限数值验证的函数表达式请求。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_0_15 = defineDataSchema({
  "type_key": "era.expression.request",
  "representation": "json",
  "display_name": "函数表达式请求",
  "description": "公共求值入口接受原始输入；由 validate_request 领域节点产生输入诊断，保持 executeExpressionLayer 的 unknown 输入与返回语义。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema"}
});

export const contract_0_16 = defineDataSchema({
  "type_key": "era.expression.response",
  "representation": "json",
  "display_name": "函数表达式结果",
  "description": "独立表达式 root 的最终数值状态、诊断、随机槽位计数和可重放压缩候选。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","required":["finalState","diagnostics","compactedOperations","randomDrawsConsumed","nextDrawOffset","containsAutomaticRandom"],"properties":{"finalState":{"type":"object"},"diagnostics":{"type":"array"},"compactedOperations":{"type":"array"},"randomDrawsConsumed":{"type":"integer","minimum":0},"nextDrawOffset":{"type":"integer","minimum":0},"containsAutomaticRandom":{"type":"boolean"}},"additionalProperties":true}
});

export const contract_0_17 = defineDataSchema({
  "type_key": "era.expression.sequence.done",
  "representation": "json",
  "display_name": "顺序操作结束标记",
  "description": "表示操作游标已到达有序操作列表末尾。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"boolean"}
});

export const contract_0_18 = defineDataSchema({
  "type_key": "era.expression.sequence.state",
  "representation": "json",
  "display_name": "表达式顺序执行状态",
  "description": "包含层起始状态、当前状态、操作游标、函数库和累计诊断的显式 carry 状态。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});

export const contract_0_19 = defineDataSchema({
  "type_key": "era.expression.symbolic.layer",
  "representation": "json",
  "display_name": "符号层变化",
  "description": "以 @path 表示层开始状态的顺序替换结果。",
  "schema": {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","additionalProperties":true}
});
