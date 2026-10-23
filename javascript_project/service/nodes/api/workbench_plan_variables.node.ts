import {defineNode} from "@vibeflow/plugin";

export const era_workbench_plan_variables = defineNode({
  "display_name": "把变量编辑草稿转换为增删改操作",
  "description": "比较当前变量与用户期望值，列出有顺序的新增、删除和公式修改。对象类型或模板发生变化时安排先移除再建立，并标出差异位置，供保护处理和正式提交使用。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.workbench.draft","cardinality":"exactly_one","display_name":"用户尚待提交的变量或函数编辑稿"}],"provides":[{"key":"variable_operation_plan","type":"era.workbench.operation_plan","display_name":"根据编辑差异安排的操作清单"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.workbench.draft":["记录用户期望的修改和编辑时的原值，供检查是否仍适用及计算差异。"]},"output_semantics":{"variable_operation_plan":["列出草稿需要的增删改及保护处理，尚待正式提交许可和执行。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"immediate","source":{"kind":"file","ref":"nodes/api/workbench_plan_variables.ts","export":"run"}}],
  "base_libs": ["era.workbench.context","era.workbench.draft"],
  "capabilities": [],
  "tags": ["工作台提交"],
  "rulesets": ["vibeflow.process"],
  "id": "era.workbench.plan_variables",
  "node_type": "vibeflow.node"
});
