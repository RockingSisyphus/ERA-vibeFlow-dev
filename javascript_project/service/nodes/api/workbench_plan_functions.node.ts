import {defineNode} from "@vibeflow/plugin";

export const era_workbench_plan_functions = defineNode({
  "display_name": "把函数编辑草稿转换为增删改操作",
  "description": "比较现有自定义函数和用户编辑稿，按顺序列出新增、修改和删除。保留原定义及类型资料，供后续检查完整函数库并应用用户的编辑。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.workbench.draft","cardinality":"exactly_one","display_name":"用户尚待提交的变量或函数编辑稿"}],"provides":[{"key":"function_operation_plan","type":"era.workbench.operation_plan","display_name":"根据编辑差异安排的操作清单"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.workbench.draft":["记录用户期望的修改和编辑时的原值，供检查是否仍适用及计算差异。"]},"output_semantics":{"function_operation_plan":["列出草稿需要的增删改及保护处理，尚待正式提交许可和执行。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"immediate","source":{"kind":"file","ref":"nodes/api/workbench_plan_functions.ts","export":"run"}}],
  "base_libs": ["era.workbench.context","era.workbench.draft","era.workbench.operations"],
  "capabilities": [],
  "tags": ["工作台提交"],
  "rulesets": ["vibeflow.process"],
  "id": "era.workbench.plan_functions",
  "node_type": "vibeflow.node"
});
