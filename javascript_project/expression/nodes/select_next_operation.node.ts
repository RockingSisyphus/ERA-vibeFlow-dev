import {defineNode} from "@vibeflow/plugin";

export const era_expression_select_next_operation = defineNode({
  "display_name": "取出接下来要计算的一项公式",
  "description": "根据当前进度取出下一项变量公式，附上此时的变量、函数和随机使用位置。将这些资料交给求值步骤，确保公式按原顺序使用前面已经产生的结果。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.sequence.state","cardinality":"exactly_one","display_name":"当前公式计算位置和已更新变量"}],"provides":[{"key":"current_operation","type":"era.expression.operation.current","display_name":"当前一项公式及计算所需变量"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.sequence.state":["包含原始起点、函数、累计结果及随机进度，供逐项计算。"]},"output_semantics":{"current_operation":["从有序操作中按当前位置选出，供求值后更新相应目标。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/select_next_operation.ts","export":"run"}}],
  "base_libs": ["era.expression.execution","era.expression.types"],
  "tags": ["表达式循环"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.select_next_operation",
  "node_type": "vibeflow.node"
});
