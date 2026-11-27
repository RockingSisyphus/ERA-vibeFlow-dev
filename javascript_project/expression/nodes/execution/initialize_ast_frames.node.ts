import {defineNode} from "@vibeflow/plugin";

export const era_expression_initialize_ast_frames = defineNode({
  "display_name": "列出当前公式需要完成的计算步骤",
  "description": "把当前公式拆成待处理的运算、子表达式和函数参数，建立逐步求值的进度。无效公式或函数库的错误会继续保留，供最终判断；本环节只准备步骤，还没有写入变量。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.operation.current","cardinality":"exactly_one","display_name":"当前一项公式及计算所需变量"}],"provides":[{"key":"ast_frame_state","type":"era.expression.ast_frame.state","display_name":"当前公式各步运算和函数参数的进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.operation.current":["从有序操作中按当前位置选出，供求值后更新相应目标。"]},"output_semantics":{"ast_frame_state":["供逐步计算嵌套表达式及函数，仍保留无效输入的错误结论。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/execution/initialize_ast_frames.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.types"],
  "tags": ["表达式循环"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.initialize_ast_frames",
  "node_type": "vibeflow.node"
});
