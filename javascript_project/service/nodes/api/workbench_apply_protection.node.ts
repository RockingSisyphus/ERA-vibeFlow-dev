import {defineNode} from "@vibeflow/plugin";

export const era_workbench_apply_protection_choice = defineNode({
  "display_name": "按用户选择安排受保护变量的修改",
  "description": "根据实际变量差异，判断哪些内容受保护、是否已有有效的解锁选择。允许修改时依次安排解锁、变更及恢复保护；不可修改或选择过期时给出原因，供提交许可检查使用。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.workbench.operation_plan","cardinality":"exactly_one","display_name":"根据编辑差异安排的操作清单"}],"provides":[{"key":"protected_preparation_result","type":"era.workbench.preparation_result","display_name":"草稿转换出的操作或检查问题"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.workbench.operation_plan":["列出草稿需要的增删改及保护处理，尚待正式提交许可和执行。"]},"output_semantics":{"protected_preparation_result":["包含有序操作和提交依据，或要求重读、修改、重新选择保护方式的原因。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"immediate","source":{"kind":"file","ref":"nodes/api/workbench_apply_protection.ts","export":"run"}}],
  "base_libs": ["era.workbench.context","era.workbench.operations","era.workbench.protection"],
  "capabilities": [],
  "tags": ["工作台提交"],
  "rulesets": ["vibeflow.process"],
  "id": "era.workbench.apply_protection_choice",
  "node_type": "vibeflow.node"
});
