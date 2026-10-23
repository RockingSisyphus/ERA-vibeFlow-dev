import {defineNode} from "@vibeflow/plugin";

export const era_expression_commit_operation_result = defineNode({
  "display_name": "采用有效计算结果并推进一项",
  "description": "检查当前公式是否计算成功，且结果为有效数值；合格时更新本轮内存中的目标变量，同时记录随机使用和执行结果。有错误时保留原因，再按既定规则推进计算进度。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.expression.operation.current","cardinality":"exactly_one","display_name":"当前一项公式及计算所需变量"},{"type":"era.expression.value","cardinality":"exactly_one","display_name":"当前公式实际算出的数值及问题"}],"provides":[{"key":"sequence_state_next","type":"era.expression.sequence.state","display_name":"当前公式计算位置和已更新变量"},{"key":"sequence_done","type":"era.expression.sequence.done","display_name":"有序公式是否已经全部处理"},{"key":"operation_execution_result","type":"era.expression.execution.result","display_name":"本轮公式得到的变量和随机使用记录"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.expression.operation.current":["从有序操作中按当前位置选出，供求值后更新相应目标。"],"era.expression.value":["尚需检查成功且数值有效，才能应用到本轮目标变量。"]},"output_semantics":{"sequence_state_next":["包含原始起点、函数、累计结果及随机进度，供逐项计算。"],"sequence_done":["供控制逐项计算循环结束，随后整理整体结果。"],"operation_execution_result":["供整理计算响应以及比较可保持相同效果的公式缩短方案。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/execution/commit_operation_result.ts","export":"run"}}],
  "base_libs": ["era.expression.types","era.expression.operation"],
  "capabilities": [],
  "tags": ["表达式循环"],
  "rulesets": ["vibeflow.process"],
  "id": "era.expression.commit_operation_result",
  "node_type": "vibeflow.node"
});
