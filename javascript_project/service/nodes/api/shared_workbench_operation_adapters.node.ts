import {defineNode} from "@vibeflow/plugin";

export const era_workbench_normalize_ordered = defineNode({
  "display_name": "检查已有操作清单并保留顺序",
  "description": "接收明确列出的变量或函数操作，检查种类及格式，保留原先先后顺序。有效列表交给后续提交检查，格式问题则带着具体原因返回。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.workbench.draft","cardinality":"exactly_one","display_name":"用户尚待提交的变量或函数编辑稿"}],"provides":[{"key":"ordered_operation_plan","type":"era.workbench.operation_plan","display_name":"根据编辑差异安排的操作清单"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.workbench.draft":["记录用户期望的修改和编辑时的原值，供检查是否仍适用及计算差异。"]},"output_semantics":{"ordered_operation_plan":["列出草稿需要的增删改及保护处理，尚待正式提交许可和执行。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"immediate","source":{"kind":"file","ref":"nodes/api/shared_workbench_operation_adapters.ts","export":"WorkbenchNormalizeOrderedNode"}}],
  "base_libs": ["era.workbench.context","era.workbench.operations"],
  "tags": ["工作台提交"],
  "rulesets": ["vibeflow.process"],
  "id": "era.workbench.normalize_ordered",
  "node_type": "vibeflow.node"
});

export const era_workbench_validate_draft_basis = defineNode({
  "display_name": "确认编辑草稿仍对应当前聊天数据",
  "description": "核对草稿所属聊天、状态文件及编辑前的值。单项编辑比较目标项，整库编辑比较整份数据，新增项检查是否仍未存在；资料已经变化或输入无效时要求重新读取或修改，避免覆盖他人的新改动。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.workbench.baseline","cardinality":"exactly_one","display_name":"当前聊天用于比较草稿的真实数据"}],"provides":[{"key":"draft","type":"era.workbench.draft","display_name":"用户尚待提交的变量或函数编辑稿"},{"key":"draft_kind","type":"era.workbench.kind","display_name":"本次编辑的是变量还是函数"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.workbench.baseline":["包含文件绑定、变量和函数，供确认草稿原值是否过期及规划修改。"]},"output_semantics":{"draft":["记录用户期望的修改和编辑时的原值，供检查是否仍适用及计算差异。"],"draft_kind":["供草稿流程选择变量差异比较或函数定义比较。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"immediate","source":{"kind":"file","ref":"nodes/api/shared_workbench_operation_adapters.ts","export":"WorkbenchValidateDraftNode"}}],
  "base_libs": ["era.workbench.context","era.workbench.operations"],
  "tags": ["工作台提交"],
  "rulesets": ["vibeflow.process"],
  "id": "era.workbench.validate_draft_basis",
  "node_type": "vibeflow.node"
});
