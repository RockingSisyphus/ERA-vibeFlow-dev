import {defineNode} from "@vibeflow/plugin";

export const era_workbench_publish_preparation = defineNode({
  "display_name": "交出草稿转换后的提交操作",
  "description": "草稿比较成功时，将得到的有序操作、目标聊天资料和提交方式交给统一许可检查。准备失败时传出具体问题及原请求，供接口返回给用户。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.workbench.preparation_result","cardinality":"exactly_one","display_name":"草稿转换出的操作或检查问题"}],"provides":[{"key":"prepared_commit_inspected","type":"era.api.commit.inspected","display_name":"已识别内容和消息范围的提交请求"},{"key":"preparation_route","type":"era.workbench.preparation_route","display_name":"草稿可继续提交还是需要返回问题"},{"key":"preparation_failure","type":"era.api.commit.failure_context","display_name":"本次提交不能执行的原因及原请求"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.workbench.preparation_result":["包含有序操作和提交依据，或要求重读、修改、重新选择保护方式的原因。"]},"output_semantics":{"prepared_commit_inspected":["包含本次变量提交及允许处理范围，供草稿转换和执行许可检查使用。"],"preparation_route":["记录草稿准备的检查结论，供进入提交许可检查或失败回告。"],"preparation_failure":["保存跳过或失败的具体依据，供接口向原调用方返回准确说明。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"immediate","source":{"kind":"file","ref":"nodes/api/shared_workbench_adapters.ts","export":"WorkbenchPublishPreparationNode"}}],
  "base_libs": ["era.workbench.context"],
  "tags": ["工作台提交"],
  "rulesets": ["vibeflow.process"],
  "id": "era.workbench.publish_preparation",
  "node_type": "vibeflow.node"
});

export const era_workbench_reject_draft = defineNode({
  "display_name": "向用户说明草稿为何不能提交",
  "description": "接收编辑草稿的检查问题，将其整理为接口可返回的失败结果。说明当前资料需要重新读取，还是用户输入需要修改，使界面能够解释本次未提交的原因。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.workbench.draft","cardinality":"exactly_one","display_name":"用户尚待提交的变量或函数编辑稿"}],"provides":[{"key":"rejected_preparation_result","type":"era.workbench.preparation_result","display_name":"草稿转换出的操作或检查问题"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.workbench.draft":["记录用户期望的修改和编辑时的原值，供检查是否仍适用及计算差异。"]},"output_semantics":{"rejected_preparation_result":["包含有序操作和提交依据，或要求重读、修改、重新选择保护方式的原因。"]}},
  "implementations": [{"language":"typescript","targets":["browser"],"completion":"immediate","source":{"kind":"file","ref":"nodes/api/shared_workbench_adapters.ts","export":"WorkbenchRejectDraftNode"}}],
  "base_libs": ["era.workbench.context"],
  "tags": ["工作台提交"],
  "rulesets": ["vibeflow.process"],
  "id": "era.workbench.reject_draft",
  "node_type": "vibeflow.node"
});
