import {defineNode} from "@vibeflow/plugin";

export const era_task_carry_candidate_inputs = defineNode({
  "display_name": "保留生成尝试对应的原请求",
  "description": "取出原生成任务、所属批次和事件来源，交给生成起点准备。后续模型结果和失败重试都可以准确回到这次请求。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.task.continuation.context","cardinality":"exactly_one","display_name":"执行后回告所需的原任务资料"}],"provides":[{"key":"carry_candidate_inputs_context","type":"era.task.continuation.context","display_name":"执行后回告所需的原任务资料"},{"key":"carry_candidate_inputs_step","type":"era.step.request.routed","display_name":"当前任务及已读取的聊天资料"},{"key":"carry_candidate_inputs_batch","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.task.continuation.context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]},"output_semantics":{"carry_candidate_inputs_context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"],"carry_candidate_inputs_step":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"carry_candidate_inputs_batch":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/task_execution_routes.ts","export":"carryCandidateInputs"}}],
  "base_libs": ["era.service.facade_api_engine","era.service.task_continuation"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.task.carry_candidate_inputs",
  "node_type": "vibeflow.node"
});

export const era_task_carry_preparation_context = defineNode({
  "display_name": "保留任务准备前的原请求资料",
  "description": "让原任务、批次和事件来源穿过资料准备流程继续传递。执行和结算环节据此知道正在处理谁的请求，保留正确的回复依据。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.task.continuation.context","cardinality":"exactly_one","display_name":"执行后回告所需的原任务资料"}],"provides":[{"key":"carry_preparation_context_result","type":"era.task.continuation.context","display_name":"执行后回告所需的原任务资料"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.task.continuation.context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]},"output_semantics":{"carry_preparation_context_result":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/task_execution_routes.ts","export":"carryPreparationContext"}}],
  "base_libs": ["era.service.facade_api_engine","era.service.task_continuation"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.task.carry_preparation_context",
  "node_type": "vibeflow.node"
});

export const era_task_finish_result = defineNode({
  "display_name": "按原发起方式返回本项任务结果",
  "description": "接收变量提交、历史同步、生成或简单任务的实际结论，按脚本接口或普通事件需要的形式整理处理确认。保留成功值与失败原因，再交给批次汇总。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.task.continuation.context","cardinality":"exactly_one","display_name":"执行后回告所需的原任务资料"},{"type":"era.api.facade.result","cardinality":"optional_one","display_name":"变量接口的实际处理确认"},{"type":"era.task.result","cardinality":"optional_one","display_name":"本项任务对应原事件的处理结果"},{"type":"era.task.execution.result.selected","cardinality":"optional_one","display_name":"任务准备时已确定可直接返回的结果"}],"provides":[{"key":"finished_task_result","type":"era.task.result","display_name":"本项任务对应原事件的处理结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.task.continuation.context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"],"era.api.facade.result":["记录本次操作在内存的应用、跳过或失败结论，调用方再按相应任务流程安排保存。"],"era.task.result":["包含实际成功、无变化、失败或取消，以及通知和问题说明，供批次集中回告发起者。"],"era.task.execution.result.selected":["例如输入失败、无需处理或已经完成的准备结论，供直接形成原请求确认。"]},"output_semantics":{"finished_task_result":["包含实际成功、无变化、失败或取消，以及通知和问题说明，供批次集中回告发起者。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/task_execution_routes.ts","export":"finishResult"}}],
  "base_libs": ["era.service.facade_api_engine","era.service.task_continuation"],
  "capabilities": [],
  "tags": ["服务任务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.task.finish_result",
  "node_type": "vibeflow.node"
});

export const era_task_prepare_plain_sync = defineNode({
  "display_name": "准备统一的聊天历史同步请求",
  "description": "接收普通历史同步任务，带入所属批次和已经读取的聊天资料，交给共享同步流程。保留原事件，使重算、保存和结果返回属于同一次请求。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"},{"type":"era.task.continuation.context","cardinality":"exactly_one","display_name":"执行后回告所需的原任务资料"}],"provides":[{"key":"prepare_plain_sync_prepared_task","type":"era.task.prepared","display_name":"已备齐的执行请求或直接返回结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"era.task.continuation.context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]},"output_semantics":{"prepare_plain_sync_prepared_task":["说明当前任务可执行的请求及所需资料，或已经确定的无变化、失败等结果，供执行选择使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/task_execution_routes.ts","export":"preparePlainSync"}}],
  "base_libs": ["era.service.facade_api_engine","era.service.task_continuation"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.task.prepare_plain_sync",
  "node_type": "vibeflow.node"
});

export const era_task_prepare_simple = defineNode({
  "display_name": "准备标识、生成设置或忽略任务",
  "description": "接收消息标识、生成设置或无需处理的事件任务，整理已读取的资料并交给简单任务入口。后续按任务种类执行操作并返回处理确认。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"},{"type":"era.task.route","cardinality":"exactly_one","display_name":"本次任务应进入的业务流程"}],"provides":[{"key":"simple_prepared_task","type":"era.task.prepared","display_name":"已备齐的执行请求或直接返回结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"era.task.route":["标明历史同步、消息标识、生成设置或忽略等已选择方向，供后续执行对应处理。"]},"output_semantics":{"simple_prepared_task":["说明当前任务可执行的请求及所需资料，或已经确定的无变化、失败等结果，供执行选择使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/task_execution_routes.ts","export":"prepareSimpleTask"}}],
  "base_libs": ["era.service.facade_api_engine","era.service.task_continuation"],
  "capabilities": [],
  "tags": ["服务任务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.task.prepare_simple",
  "node_type": "vibeflow.node"
});

export const era_task_route_entry = defineNode({
  "display_name": "按任务种类选择准备流程",
  "description": "接收批次当前任务，判断它属于初始化、脚本接口、多阶段生成、历史同步还是简单任务。选择对应准备入口，让每种任务只读取并整理它真正需要的资料。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"},{"type":"era.task.route","cardinality":"exactly_one","display_name":"本次任务应进入的业务流程"}],"provides":[{"key":"route_entry_entry_route","type":"era.task.entry.route","display_name":"应进入的任务准备流程"},{"key":"route_entry_routed_step","type":"era.step.request.routed","display_name":"当前任务及已读取的聊天资料"},{"key":"route_entry_batch_state","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"},{"key":"route_entry_task_route","type":"era.task.route","display_name":"本次任务应进入的业务流程"},{"key":"route_entry_entry_continuation","type":"era.task.continuation.context","display_name":"执行后回告所需的原任务资料"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"era.task.route":["标明历史同步、消息标识、生成设置或忽略等已选择方向，供后续执行对应处理。"]},"output_semantics":{"route_entry_entry_route":["在初始化、脚本接口、生成、普通同步和简单任务之间选择。"],"route_entry_routed_step":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"route_entry_batch_state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"route_entry_task_route":["标明历史同步、消息标识、生成设置或忽略等已选择方向，供后续执行对应处理。"],"route_entry_entry_continuation":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/task_execution_routes.ts","export":"routeEntry"}}],
  "base_libs": ["era.service.facade_api_engine","era.service.task_continuation"],
  "capabilities": [],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.task.route_entry",
  "node_type": "vibeflow.node"
});

export const era_task_select_action = defineNode({
  "display_name": "按准备结果选择实际执行流程",
  "description": "接收当前任务已准备的资料，选择变量提交、历史同步、模型生成、简单任务或直接返回。把对应请求和原任务一起交给选定分支，供完成后统一结算。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.task.prepared","cardinality":"exactly_one","display_name":"已备齐的执行请求或直接返回结论"}],"provides":[{"key":"action_route","type":"era.task.action.route","display_name":"准备完成后应执行的具体业务"},{"key":"action_continuation","type":"era.task.continuation.context","display_name":"执行后回告所需的原任务资料"},{"key":"action_batch","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"},{"key":"action_step","type":"era.step.request.routed","display_name":"当前任务及已读取的聊天资料"},{"key":"action_commit","type":"era.api.request.selected","display_name":"已经选中的接口请求"},{"key":"action_candidate","type":"era.agent.candidate.state.selected","display_name":"本次选中的模型请求和恢复起点"},{"key":"action_simple","type":"era.task.route.selected","display_name":"已选中的简单任务处理种类"},{"key":"action_direct","type":"era.task.execution.result.selected","display_name":"任务准备时已确定可直接返回的结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.task.prepared":["说明当前任务可执行的请求及所需资料，或已经确定的无变化、失败等结果，供执行选择使用。"]},"output_semantics":{"action_route":["供选择变量提交、历史同步、模型生成、简单任务或直接返回。"],"action_continuation":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"],"action_batch":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"action_step":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"action_commit":["保留当前分支要处理的原请求，供检查和准备明确执行资料。"],"action_candidate":["交给生成尝试循环，原任务与批次资料一并保留。"],"action_simple":["指明消息标识、生成设置或忽略事件，供对应执行分支。"],"action_direct":["例如输入失败、无需处理或已经完成的准备结论，供直接形成原请求确认。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/task_execution_routes.ts","export":"selectAction"}}],
  "base_libs": ["era.service.facade_api_engine","era.service.task_continuation"],
  "capabilities": [],
  "tags": ["服务任务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.task.select_action",
  "node_type": "vibeflow.node"
});

export const era_task_select_followup = defineNode({
  "display_name": "决定生成结束后还要处理什么",
  "description": "接收模型阶段的结论，选择继续历史同步、确认消息标识或直接返回结果。保留原任务、批次及发起来源，让生成后续处理仍能正确回告。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.task.prepared","cardinality":"exactly_one","display_name":"已备齐的执行请求或直接返回结论"}],"provides":[{"key":"followup_route","type":"era.task.action.route","display_name":"准备完成后应执行的具体业务"},{"key":"followup_continuation","type":"era.task.continuation.context","display_name":"执行后回告所需的原任务资料"},{"key":"followup_batch","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"},{"key":"followup_step","type":"era.step.request.routed","display_name":"当前任务及已读取的聊天资料"},{"key":"followup_direct","type":"era.task.execution.result.selected","display_name":"任务准备时已确定可直接返回的结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.task.prepared":["说明当前任务可执行的请求及所需资料，或已经确定的无变化、失败等结果，供执行选择使用。"]},"output_semantics":{"followup_route":["供选择变量提交、历史同步、模型生成、简单任务或直接返回。"],"followup_continuation":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"],"followup_batch":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"followup_step":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"followup_direct":["例如输入失败、无需处理或已经完成的准备结论，供直接形成原请求确认。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/task_execution_routes.ts","export":"selectFollowup"}}],
  "base_libs": ["era.service.facade_api_engine","era.service.task_continuation"],
  "capabilities": [],
  "tags": ["服务任务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.task.select_followup",
  "node_type": "vibeflow.node"
});
