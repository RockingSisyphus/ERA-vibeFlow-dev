import {defineNode} from "@vibeflow/plugin";

export const era_agent_build_result = defineNode({
  "display_name": "返回生成阶段结果并通知页面",
  "description": "把本次生成阶段的成功、取消或失败整理成原任务的处理确认，附上阶段完成信息和具体问题。需要继续时一并提供页面通知，让订阅回调完成后能够启动下一阶段。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.agent.session.transition","cardinality":"exactly_one","display_name":"生成后需要继续的消息处理"}],"provides":[{"key":"agent_task_result_direct","type":"era.task.result","display_name":"本项任务对应原事件的处理结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.session.transition":["记录生成阶段是否还需历史同步、消息标识确认或直接返回，供外层选择相应流程。"]},"output_semantics":{"agent_task_result_direct":["包含实际成功、无变化、失败或取消，以及通知和问题说明，供批次集中回告发起者。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/shared_agent_flow_adapters.ts","export":"BuildAgentResultNode"}}],
  "base_libs": ["era.service.agent_flow_policy","era.service.agent_flow_types","era.service.agent_task_result","era.service.task_continuation","era.service.types"],
  "tags": ["故事生成会话"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.build_result",
  "node_type": "vibeflow.node"
});

export const era_agent_build_settings_result = defineNode({
  "version": "1.0.0",
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/shared_agent_flow_adapters.ts","export":"BuildSettingsResultNode"}}],
  "display_name": "向发起者返回生成设置结果",
  "description": "接收配置、预设、连接或模型列表操作的实际结果，匹配原始请求，形成处理确认。成功值和失败原因都保留，供界面或脚本显示与使用。",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"},{"type":"era.agent.settings.outcome","cardinality":"exactly_one","display_name":"生成设置操作的实际结果"}],"provides":[{"key":"settings_result","type":"era.task.result","display_name":"本项任务对应原事件的处理结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"era.agent.settings.outcome":["记录本次设置读取或修改真正返回的内容及问题，供原请求获得处理确认。"]},"output_semantics":{"settings_result":["包含实际成功、无变化、失败或取消，以及通知和问题说明，供批次集中回告发起者。"]}},
  "base_libs": ["era.service.agent_flow_policy","era.service.agent_flow_types","era.service.agent_task_result","era.service.task_continuation","era.service.types"],
  "tags": ["Agent 工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.build_settings_result",
  "node_type": "vibeflow.node"
});

export const era_agent_classify_generation_event = defineNode({
  "version": "1.0.0",
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/shared_agent_flow_adapters.ts","export":"ClassifyGenerationEventNode"}}],
  "display_name": "判断这次应执行哪个生成阶段",
  "description": "接收首次生成、继续、重试或页面恢复请求，结合当前聊天和消息版本，判断应进入规划、正文还是结算阶段。请求已过期时记录原因，供外层返回而不处理旧生成。",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.agent.generation.facts","cardinality":"exactly_one","display_name":"可用于判断生成阶段的聊天资料"}],"provides":[{"key":"generation_decision","type":"era.agent.generation.decision","display_name":"本次选择的生成阶段及原因"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.generation.facts":["包含本次聊天、保留正文、配置和已恢复的变量起点或失败原因，供生成阶段选择使用。"]},"output_semantics":{"generation_decision":["标明进入规划、正文或结算，或当前请求已失效，供组装正确的模型请求。"]}},
  "base_libs": ["era.service.agent_flow_policy","era.service.agent_flow_types","era.service.agent_task_result","era.service.task_continuation","era.service.types"],
  "tags": ["Agent 工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.classify_generation_event",
  "node_type": "vibeflow.node"
});

export const era_agent_prepare_generation_phase = defineNode({
  "version": "1.0.0",
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/shared_agent_flow_adapters.ts","export":"PrepareGenerationPhaseNode"}}],
  "display_name": "组装当前生成阶段需要的完整资料",
  "description": "根据已确定的规划、正文或结算阶段，整理模型设置、消息历史、变量起点和会话进度。资料无效时返回具体原因，有效时交给模型生成尝试。",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.agent.generation.decision","cardinality":"exactly_one","display_name":"本次选择的生成阶段及原因"}],"provides":[{"key":"generation_request","type":"era.agent.generation.request","display_name":"本次模型生成要求与聊天起点"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.generation.decision":["标明进入规划、正文或结算，或当前请求已失效，供组装正确的模型请求。"]},"output_semantics":{"generation_request":["包含当前生成阶段、模型设置、提示资料及所属聊天，供本次模型调用和文字指令处理使用。"]}},
  "base_libs": ["era.service.agent_flow_policy","era.service.agent_flow_types","era.service.agent_task_result","era.service.task_continuation","era.service.types"],
  "tags": ["Agent 工作流"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.prepare_generation_phase",
  "node_type": "vibeflow.node"
});

export const era_agent_prepare_candidate_continuation = defineNode({
  "display_name": "把准备好的生成请求交给尝试循环",
  "description": "接收已确认起点的生成请求，连同原任务和所属批次交给生成循环。循环据此请求模型、执行文字中的指令，并在允许时重试，结果仍能对应原发起者。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.agent.candidate.state","cardinality":"exactly_one","display_name":"本次生成尝试的请求和恢复起点"},{"type":"era.task.continuation.context","cardinality":"exactly_one","display_name":"执行后回告所需的原任务资料"}],"provides":[{"key":"prepare_candidate_continuation_prepared_task","type":"era.task.prepared","display_name":"已备齐的执行请求或直接返回结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.candidate.state":["记录本次模型尝试的请求、原任务及出错后应恢复的状态，供生成、指令应用和允许的重试共同使用。"],"era.task.continuation.context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]},"output_semantics":{"prepare_candidate_continuation_prepared_task":["说明当前任务可执行的请求及所需资料，或已经确定的无变化、失败等结果，供执行选择使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/shared_agent_flow_adapters.ts","export":"prepareCandidateContinuation"}}],
  "base_libs": ["era.service.agent_flow_policy","era.service.agent_flow_types","era.service.agent_task_result","era.service.task_continuation","era.service.types"],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.prepare_candidate_continuation",
  "node_type": "vibeflow.node"
});

export const era_agent_prepare_direct_continuation = defineNode({
  "display_name": "整理无需继续生成的阶段结果",
  "description": "接收已经完成交接、被取消或失败的生成阶段结论，将其与原任务对应。交给任务结算环节直接返回，保留阶段信息和具体原因。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.task.result","cardinality":"exactly_one","display_name":"本项任务对应原事件的处理结果"},{"type":"era.task.continuation.context","cardinality":"exactly_one","display_name":"执行后回告所需的原任务资料"}],"provides":[{"key":"prepare_direct_continuation_prepared_task","type":"era.task.prepared","display_name":"已备齐的执行请求或直接返回结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.task.result":["包含实际成功、无变化、失败或取消，以及通知和问题说明，供批次集中回告发起者。"],"era.task.continuation.context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]},"output_semantics":{"prepare_direct_continuation_prepared_task":["说明当前任务可执行的请求及所需资料，或已经确定的无变化、失败等结果，供执行选择使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/shared_agent_flow_adapters.ts","export":"prepareDirectContinuation"}}],
  "base_libs": ["era.service.agent_flow_policy","era.service.agent_flow_types","era.service.agent_task_result","era.service.task_continuation","era.service.types"],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.prepare_direct_continuation",
  "node_type": "vibeflow.node"
});

export const era_agent_prepare_legacy_continuation = defineNode({
  "display_name": "把生成后的消息交给统一同步流程",
  "description": "接收生成文字及其中指令已应用的结果，整理后续需要的历史同步或消息标识任务。保留可处理范围和原事件，让统一消息流程接着完成保存与确认。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"},{"type":"era.task.route","cardinality":"exactly_one","display_name":"本次任务应进入的业务流程"},{"type":"era.task.continuation.context","cardinality":"exactly_one","display_name":"执行后回告所需的原任务资料"}],"provides":[{"key":"prepare_legacy_continuation_prepared_task","type":"era.task.prepared","display_name":"已备齐的执行请求或直接返回结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"era.task.route":["标明历史同步、消息标识、生成设置或忽略等已选择方向，供后续执行对应处理。"],"era.task.continuation.context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]},"output_semantics":{"prepare_legacy_continuation_prepared_task":["说明当前任务可执行的请求及所需资料，或已经确定的无变化、失败等结果，供执行选择使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/shared_agent_flow_adapters.ts","export":"prepareLegacyContinuation"}}],
  "base_libs": ["era.service.agent_flow_policy","era.service.agent_flow_types","era.service.agent_task_result","era.service.task_continuation","era.service.types"],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.prepare_legacy_continuation",
  "node_type": "vibeflow.node"
});

export const era_agent_unpack_finish_context = defineNode({
  "display_name": "取出生成结论对应的原任务",
  "description": "从已经结束的生成尝试中取出原任务、所属批次及文字指令的应用结果。阶段交接和任务结算据此报告本次生成，避免把结果对应到其他请求。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.agent.candidate.outcome","cardinality":"exactly_one","display_name":"生成尝试结束后的完整结果"},{"type":"era.task.continuation.context","cardinality":"exactly_one","display_name":"执行后回告所需的原任务资料"}],"provides":[{"key":"unpack_finish_context_finish_step","type":"era.step.request.routed","display_name":"当前任务及已读取的聊天资料"},{"key":"unpack_finish_context_finish_batch","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"},{"key":"unpack_finish_context_candidate_outcome","type":"era.agent.candidate.outcome","display_name":"生成尝试结束后的完整结果"},{"key":"unpack_finish_context_finish_context","type":"era.task.continuation.context","display_name":"执行后回告所需的原任务资料"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.candidate.outcome":["记录生成及文字指令处理的最终结论，供后续整理阶段交接和原请求确认。"],"era.task.continuation.context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]},"output_semantics":{"unpack_finish_context_finish_step":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"unpack_finish_context_finish_batch":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"unpack_finish_context_candidate_outcome":["记录生成及文字指令处理的最终结论，供后续整理阶段交接和原请求确认。"],"unpack_finish_context_finish_context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/agent/shared_agent_flow_adapters.ts","export":"unpackFinishContext"}}],
  "base_libs": ["era.service.agent_flow_policy","era.service.agent_flow_types","era.service.agent_task_result","era.service.task_continuation","era.service.types"],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.unpack_finish_context",
  "node_type": "vibeflow.node"
});
