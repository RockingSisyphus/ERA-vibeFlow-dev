import {defineNode} from "@vibeflow/plugin";

export const era_api_validate_commit = defineNode({
  "display_name": "判断这次变量提交是否允许执行",
  "description": "检查脚本或界面提交的操作顺序、来源和有效消息范围。按提交模式决定执行、跳过已处理内容或拒绝过期请求，并保留原因；回复分支的执行记录单独判断，供后续安全应用变量变更。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.api.commit.inspected","cardinality":"exactly_one","display_name":"已识别内容和消息范围的提交请求"}],"provides":[{"key":"commit_admission_route","type":"era.api.commit.admission.route","display_name":"提交应执行、跳过或失败的方向"},{"key":"facade_commit_validated","type":"era.api.commit.validated","display_name":"已确认允许应用的有序操作"},{"key":"facade_commit_validation_failure","type":"era.api.commit.failure_context","display_name":"本次提交不能执行的原因及原请求"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.api.commit.inspected":["包含本次变量提交及允许处理范围，供草稿转换和执行许可检查使用。"]},"output_semantics":{"commit_admission_route":["记录本次变量提交的实际许可结论，供应用操作或直接返回原因。"],"facade_commit_validated":["包含通过提交检查的变量和函数操作及目标范围，供统一消息流程按原顺序计算。"],"facade_commit_validation_failure":["保存跳过或失败的具体依据，供接口向原调用方返回准确说明。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/api/facade_nodes.ts","export":"validateCommitNode"}}],
  "base_libs": ["era.service.facade_api_engine","era.service.sidecar_binding","era.service.sync_contracts","era.service.sync_result_policy","era.service.sync_work_preparation","era.service.task_continuation","era.service.types","era.service.working_state","era.workbench.context"],
  "tags": ["公共 Facade"],
  "rulesets": ["vibeflow.process"],
  "id": "era.api.validate_commit",
  "node_type": "vibeflow.node"
});

export const era_api_identify_task_request = defineNode({
  "display_name": "区分变量提交和历史重算请求",
  "description": "读取脚本或界面发来的请求，判断它要直接提交变量操作，还是根据聊天历史重新计算。将请求和原任务资料送到对应的准备流程，供完成后返回处理结果。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"},{"type":"era.task.continuation.context","cardinality":"exactly_one","display_name":"执行后回告所需的原任务资料"}],"provides":[{"key":"facade_request","type":"era.api.request","display_name":"脚本或界面提出的操作请求"},{"key":"facade_route","type":"era.api.route","display_name":"变量提交或历史重算的选择"},{"key":"facade_execution_state","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"},{"key":"facade_continuation","type":"era.task.continuation.context","display_name":"执行后回告所需的原任务资料"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"era.task.continuation.context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]},"output_semantics":{"facade_request":["包含变量提交或历史重算要求及原请求资料，供任务准备和最终回告。"],"facade_route":["标明接口请求需要直接提交操作，还是依据聊天历史重新计算。"],"facade_execution_state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"facade_continuation":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/api/facade_nodes.ts","export":"identifyTaskRequest"}}],
  "base_libs": ["era.service.facade_api_engine","era.service.sidecar_binding","era.service.sync_contracts","era.service.sync_result_policy","era.service.sync_work_preparation","era.service.task_continuation","era.service.types","era.service.working_state","era.workbench.context"],
  "tags": ["服务任务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.api.identify_task_request",
  "node_type": "vibeflow.node"
});

export const era_api_prepare_commit_continuation = defineNode({
  "display_name": "把已准备的变量提交交给执行流程",
  "description": "接收脚本或界面的变量提交请求，连同原任务和批次交给统一提交流程。保留发起来源，使实际应用完成后能够把成功、跳过或失败返回给对应调用方。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.api.request","cardinality":"exactly_one","display_name":"脚本或界面提出的操作请求"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"},{"type":"era.task.continuation.context","cardinality":"exactly_one","display_name":"执行后回告所需的原任务资料"}],"provides":[{"key":"prepare_commit_continuation_prepared_task","type":"era.task.prepared","display_name":"已备齐的执行请求或直接返回结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.api.request":["包含变量提交或历史重算要求及原请求资料，供任务准备和最终回告。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"era.task.continuation.context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]},"output_semantics":{"prepare_commit_continuation_prepared_task":["说明当前任务可执行的请求及所需资料，或已经确定的无变化、失败等结果，供执行选择使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/api/facade_nodes.ts","export":"prepareCommitContinuation"}}],
  "base_libs": ["era.service.facade_api_engine","era.service.sidecar_binding","era.service.sync_contracts","era.service.sync_result_policy","era.service.sync_work_preparation","era.service.task_continuation","era.service.types","era.service.working_state","era.workbench.context"],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.api.prepare_commit_continuation",
  "node_type": "vibeflow.node"
});

export const era_api_prepare_history_sync = defineNode({
  "display_name": "检查并准备按历史重算的请求",
  "description": "接收脚本或界面的历史同步请求，检查重算方式及目标消息，整理为统一的历史同步任务。方式或范围无效时形成具体失败结果，并保留原请求以便回告。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.api.request","cardinality":"exactly_one","display_name":"脚本或界面提出的操作请求"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"},{"type":"era.task.continuation.context","cardinality":"exactly_one","display_name":"执行后回告所需的原任务资料"}],"provides":[{"key":"sync_prepared","type":"era.task.prepared","display_name":"已备齐的执行请求或直接返回结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.api.request":["包含变量提交或历史重算要求及原请求资料，供任务准备和最终回告。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"era.task.continuation.context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]},"output_semantics":{"sync_prepared":["说明当前任务可执行的请求及所需资料，或已经确定的无变化、失败等结果，供执行选择使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/api/facade_nodes.ts","export":"prepareHistorySync"}}],
  "base_libs": ["era.service.facade_api_engine","era.service.sidecar_binding","era.service.sync_contracts","era.service.sync_result_policy","era.service.sync_work_preparation","era.service.task_continuation","era.service.types","era.service.working_state","era.workbench.context"],
  "tags": ["服务任务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.api.prepare_history_sync",
  "node_type": "vibeflow.node"
});

export const era_api_return_immediate_result = defineNode({
  "display_name": "返回跳过提交或输入无效的原因",
  "description": "对按规则无需再次处理的提交返回跳过说明，对无效操作或不再适用的工作台草稿返回失败原因。结果保持原接口需要的形式，让脚本或界面知道为何没有继续执行。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.api.commit.validated","cardinality":"optional_one","display_name":"已确认允许应用的有序操作"},{"type":"era.api.commit.failure_context","cardinality":"optional_one","display_name":"本次提交不能执行的原因及原请求"},{"type":"era.api.commit.admission.route","cardinality":"optional_one","display_name":"提交应执行、跳过或失败的方向"},{"type":"era.workbench.preparation_route","cardinality":"optional_one","display_name":"草稿可继续提交还是需要返回问题"}],"provides":[{"key":"immediate_facade_result","type":"era.api.facade.result","display_name":"变量接口的实际处理确认"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.api.commit.validated":["包含通过提交检查的变量和函数操作及目标范围，供统一消息流程按原顺序计算。"],"era.api.commit.failure_context":["保存跳过或失败的具体依据，供接口向原调用方返回准确说明。"],"era.api.commit.admission.route":["记录本次变量提交的实际许可结论，供应用操作或直接返回原因。"],"era.workbench.preparation_route":["记录草稿准备的检查结论，供进入提交许可检查或失败回告。"]},"output_semantics":{"immediate_facade_result":["记录本次操作在内存的应用、跳过或失败结论，调用方再按相应任务流程安排保存。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/api/facade_nodes.ts","export":"returnImmediateResult"}}],
  "base_libs": ["era.service.facade_api_engine","era.service.sidecar_binding","era.service.sync_contracts","era.service.sync_result_policy","era.service.sync_work_preparation","era.service.task_continuation","era.service.types","era.service.working_state","era.workbench.context"],
  "tags": ["服务任务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.api.return_immediate_result",
  "node_type": "vibeflow.node"
});
