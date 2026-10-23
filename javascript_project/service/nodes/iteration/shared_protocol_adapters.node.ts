import {defineNode} from "@vibeflow/plugin";

export const era_service_plan_batch = defineNode({
  "display_name": "把收齐的事件安排成有序任务",
  "description": "接收已收齐的聊天变化和脚本请求，安排初始化、历史同步、消息标识、生成或忽略任务。保留每个任务对应的原事件，让同批相关变化按顺序处理并逐一返回确认。",
  "version": "1.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.collection.reduction","cardinality":"exactly_one","display_name":"新事件合并后的等待与组批决定"}],"provides":[{"key":"batch_plan","type":"era.batch.plan","display_name":"事件对应的有序任务计划"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.collection.reduction":["包含已收事件、就绪判断和计时要求，供服务决定等待或开始执行。"]},"output_semantics":{"batch_plan":["记录本批每项任务和原事件对应关系，供检查无遗漏重复后逐项执行。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"PlanBatchNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["批次执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.plan_batch",
  "node_type": "vibeflow.node"
});

export const era_service_raise_fatal = defineNode({
  "display_name": "在已回告原因后结束严重故障的服务",
  "description": "接收已向页面报告的严重故障原因，结束当前服务执行。这样写入状态无法确认等问题不会被当成正常批次继续，而原调用方已能收到发生了什么。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.service.state.post_batch","cardinality":"exactly_one","display_name":"当前批次结束后的服务进度"}],"provides":[{"key":"fatal_state_next","type":"era.service.state.next","display_name":"下一轮服务应使用的状态"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.service.state.post_batch":["保存下一轮事件收集需要的序号、计时和计数，供继续运行。"]},"output_semantics":{"fatal_state_next":["包含已更新的收集或停止状态，让服务延续本批后的真实进度。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"RaiseFatalNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["批次发布"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.raise_fatal",
  "node_type": "vibeflow.node"
});

export const era_service_reduce_collection = defineNode({
  "display_name": "合并新事件并判断何时组成一批",
  "description": "将新收到的事件加入等待集合，结合事件先后顺序、等待期限和容量决定继续收集还是开始执行。输出更新后的事件集合及定时安排，使相关聊天变化可以统一规划。",
  "version": "1.1.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.service.state.current","cardinality":"exactly_one","display_name":"当前事件收集的服务状态"},{"type":"era.transport.event","cardinality":"exactly_one","display_name":"已通过输入检查的聊天事件"}],"provides":[{"key":"collection_reduction","type":"era.collection.reduction","display_name":"新事件合并后的等待与组批决定"},{"key":"collection_control","type":"era.collection.control","display_name":"本轮需要页面执行的计时安排"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.service.state.current":["供本轮读取事件、合并收集范围和建立下轮状态。"],"era.transport.event":["主服务可读取的当前聊天变化、脚本请求或到期事件资料。"]},"output_semantics":{"collection_reduction":["包含已收事件、就绪判断和计时要求，供服务决定等待或开始执行。"],"collection_control":["明确要求启动、取消或保留哪些收集期限，供页面计时流程执行。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"ReduceCollectionNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["服务迭代"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.reduce_collection",
  "node_type": "vibeflow.node"
});

export const era_service_route_iteration = defineNode({
  "display_name": "判断继续等事件还是开始处理",
  "description": "接收事件收集后的状态，判断这一批是否已经就绪。未就绪时回到等待，就绪时进入任务规划，让服务在合适的时间开始处理事件。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.collection.reduction","cardinality":"exactly_one","display_name":"新事件合并后的等待与组批决定"}],"provides":[{"key":"iteration_route","type":"era.iteration.route","display_name":"本轮继续等待还是开始规划任务"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.collection.reduction":["包含已收事件、就绪判断和计时要求，供服务决定等待或开始执行。"]},"output_semantics":{"iteration_route":["根据事件收集就绪情况决定服务下一步。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"RouteIterationNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["服务迭代"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.route_iteration",
  "node_type": "vibeflow.node"
});

export const era_service_select_step = defineNode({
  "display_name": "取出当前批次接下来的一项任务",
  "description": "根据批次进度取出下一项任务，连同原事件及所属批次交给准备流程。保持规划好的先后顺序，前一项的处理结果可供后续任务使用。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"selected_step","type":"era.step.request","display_name":"当前批次选出的下一项任务"},{"key":"prepared_execution_state","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"selected_step":["记录将要处理的任务和事件来源，随后会读取相应聊天资料并选择业务流程。"],"prepared_execution_state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"SelectStepNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["步骤执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.select_step",
  "node_type": "vibeflow.node"
});

export const era_task_ignore = defineNode({
  "display_name": "向被忽略事件返回原因",
  "description": "接收计划中无需实际处理的事件，为每个原事件返回忽略确认及原因。调用方因此仍能知道请求已被看见，而不会一直等待结果。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"}],"provides":[{"key":"ignore_task_result","type":"era.task.result","display_name":"本项任务对应原事件的处理结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"]},"output_semantics":{"ignore_task_result":["包含实际成功、无变化、失败或取消，以及通知和问题说明，供批次集中回告发起者。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"TaskIgnoreNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["步骤执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.task.ignore",
  "node_type": "vibeflow.node"
});

export const era_service_validate_coverage = defineNode({
  "display_name": "检查每个原事件都有且只有一次安排",
  "description": "检查本批任务与原事件的对应关系，确认没有漏处理、重复对应、无效来源或任务数超限。有效计划才能执行，问题计划带着具体原因进入整批失败结算。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.batch.plan","cardinality":"exactly_one","display_name":"事件对应的有序任务计划"}],"provides":[{"key":"coverage_route","type":"era.batch.coverage.route","display_name":"任务计划是否完整对应原事件"},{"key":"execution_state","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.batch.plan":["记录本批每项任务和原事件对应关系，供检查无遗漏重复后逐项执行。"]},"output_semantics":{"coverage_route":["检查通过时执行批次，失败时向整批原事件回告问题。"],"execution_state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"ValidateCoverageNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["批次执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.validate_coverage",
  "node_type": "vibeflow.node"
});

export const era_service_validate_transport = defineNode({
  "display_name": "检查页面送来的事件是否可处理",
  "description": "检查新事件的结构、大小和所附资料引用，整理成服务可读取的业务事件。无法处理的输入保留具体问题，供事件收集和调用方获知原因。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.transport.event.raw","cardinality":"exactly_one","display_name":"页面队列交来的原始事件"}],"provides":[{"key":"transport_event","type":"era.transport.event","display_name":"已通过输入检查的聊天事件"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.transport.event.raw":["收到后仍需检查格式、大小和资料引用，再进入业务收集。"]},"output_semantics":{"transport_event":["主服务可读取的当前聊天变化、脚本请求或到期事件资料。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"ValidateTransportNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["服务迭代"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.validate_transport",
  "node_type": "vibeflow.node"
});

export const era_service_build_outbound = defineNode({
  "display_name": "汇总发回页面的批次消息",
  "description": "把已处理事件的确认、页面通知、问题记录和停止原因组装成一份对应本批次的结果，同时准备下一轮服务状态。页面据此完成等待中的请求和后续通知。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.batch.finalization","cardinality":"exactly_one","display_name":"整批已完成任务的汇总结论"}],"provides":[{"key":"batch_result_frame","type":"era.batch.result","display_name":"应发回页面的批次确认和通知"},{"key":"batch_fatal_flag","type":"era.batch.fatal","display_name":"本批是否存在必须停止的严重问题"},{"key":"post_batch_state","type":"era.service.state.post_batch","display_name":"当前批次结束后的服务进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.batch.finalization":["包括逐事件确认和通知，供组装发回页面的结果。"]},"output_semantics":{"batch_result_frame":["这是已经结算的事件结果，不是新的待执行任务，页面据此完成原请求等待。"],"batch_fatal_flag":["记录无法安全继续服务的原因，供先回告原事件再结束服务。"],"post_batch_state":["保存下一轮事件收集需要的序号、计时和计数，供继续运行。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"BuildOutboundNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["批次发布"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.build_outbound",
  "node_type": "vibeflow.node"
});

export const era_service_continue_state = defineNode({
  "display_name": "交出下一轮收集事件的状态",
  "description": "本批结果已经发布后，将剩余事件、序号和定时安排交给下一轮服务循环。让后续聊天变化接着处理，并保留已经推进的服务进度。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.service.state.post_batch","cardinality":"exactly_one","display_name":"当前批次结束后的服务进度"}],"provides":[{"key":"continued_state_next","type":"era.service.state.next","display_name":"下一轮服务应使用的状态"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.service.state.post_batch":["保存下一轮事件收集需要的序号、计时和计数，供继续运行。"]},"output_semantics":{"continued_state_next":["包含已更新的收集或停止状态，让服务延续本批后的真实进度。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"ContinueStateNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["批次发布"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.continue_state",
  "node_type": "vibeflow.node"
});

export const era_service_coverage_failure = defineNode({
  "display_name": "向整批事件说明任务安排失败",
  "description": "任务与原事件的对应关系检查未通过时，为这批每个事件返回失败确认并附上计划问题。结束当前批次，避免执行存在遗漏或重复安排的任务。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"coverage_failure_state","type":"era.batch.execution.state.after","display_name":"本批任务结束或计划失败后的状态"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"coverage_failure_state":["供最终汇总原事件结论，并形成下一轮服务状态。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"CoverageFailureNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["批次执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.coverage_failure",
  "node_type": "vibeflow.node"
});

export const era_service_cycle_begin_execution = defineNode({
  "display_name": "从第一项开始执行已确认的批次",
  "description": "接收通过检查的任务列表，将服务切换到执行阶段，并把当前位置设为第一项。后续逐项准备和执行，不再把这批事件重新加入收集队列。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"prepared_cycle_state","type":"era.service.cycle.state","display_name":"服务当前处于收集还是执行及相应进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"prepared_cycle_state":["收集时携带事件和计时，执行时携带批次任务与结果，供每轮选择对应处理。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"BeginExecutionCycleNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["服务阶段循环"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.cycle.begin_execution",
  "node_type": "vibeflow.node"
});

export const era_service_cycle_carry_execution = defineNode({
  "display_name": "保留批次进度以继续下一项任务",
  "description": "接收当前任务结束后的批次，保留下一任务位置、累计结果和消息进度，交给服务循环。下一轮据此继续尚未完成的任务。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"settled_cycle_state","type":"era.service.cycle.state","display_name":"服务当前处于收集还是执行及相应进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"settled_cycle_state":["收集时携带事件和计时，执行时携带批次任务与结果，供每轮选择对应处理。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"CarryExecutionCycleNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["服务阶段循环"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.cycle.carry_execution",
  "node_type": "vibeflow.node"
});

export const era_service_cycle_carry_wait = defineNode({
  "display_name": "保留待处理事件继续等待",
  "description": "接收尚未达到执行条件的收集状态，保留现有事件、序号和定时器，交回服务循环。下一事件到来时可以接着合并，而不丢掉已经收集的变化。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.collection.reduction","cardinality":"exactly_one","display_name":"新事件合并后的等待与组批决定"}],"provides":[{"key":"wait_cycle_state","type":"era.service.cycle.state","display_name":"服务当前处于收集还是执行及相应进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.collection.reduction":["包含已收事件、就绪判断和计时要求，供服务决定等待或开始执行。"]},"output_semantics":{"wait_cycle_state":["收集时携带事件和计时，执行时携带批次任务与结果，供每轮选择对应处理。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"CarryWaitCycleNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["服务阶段循环"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.cycle.carry_wait",
  "node_type": "vibeflow.node"
});

export const era_service_cycle_promote_done = defineNode({
  "display_name": "把已完成批次交给最终汇总",
  "description": "接收所有任务已经结束的批次，交给批次结算环节。后续为每个原事件整理最终确认，并集中发回页面。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"execution_state_after","type":"era.batch.execution.state.after","display_name":"本批任务结束或计划失败后的状态"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"execution_state_after":["供最终汇总原事件结论，并形成下一轮服务状态。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"PromoteDoneCycleNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["服务阶段循环"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.cycle.promote_done",
  "node_type": "vibeflow.node"
});

export const era_service_cycle_resume_collect = defineNode({
  "display_name": "批次结束后恢复事件收集",
  "description": "接收已发布结果后的下一轮服务状态，将服务切回事件收集。新的聊天变化和脚本请求从这里继续进入处理。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.service.state.next","cardinality":"exactly_one","display_name":"下一轮服务应使用的状态"}],"provides":[{"key":"finished_cycle_state","type":"era.service.cycle.state","display_name":"服务当前处于收集还是执行及相应进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.service.state.next":["包含已更新的收集或停止状态，让服务延续本批后的真实进度。"]},"output_semantics":{"finished_cycle_state":["收集时携带事件和计时，执行时携带批次任务与结果，供每轮选择对应处理。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"ResumeCollectCycleNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["服务阶段循环"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.cycle.resume_collect",
  "node_type": "vibeflow.node"
});

export const era_service_cycle_route_completion = defineNode({
  "display_name": "判断当前批次是否还有任务",
  "description": "查看批次的当前位置和结束标志。仍有任务时继续执行下一项，全部结束时进入批次汇总，使每项任务都在返回整批结果前得到处理。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.step.done","cardinality":"exactly_one","display_name":"当前处理范围是否已经结束"},{"type":"era.batch.execution.state.next","cardinality":"exactly_one","display_name":"合入当前任务后的下一执行进度"}],"provides":[{"key":"completion_route","type":"era.service.cycle.completion_route","display_name":"本批还有任务还是已经全部完成"},{"key":"routed_execution_state","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.done":["循环据此继续下一消息、操作或任务，或进入本范围的最终结果整理。"],"era.batch.execution.state.next":["包含累积结果及推进后的任务位置，供批次继续或结算。"]},"output_semantics":{"completion_route":["供选择继续执行下一项，或进入整批汇总。"],"routed_execution_state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"RouteCompletionCycleNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["服务阶段循环"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.cycle.route_completion",
  "node_type": "vibeflow.node"
});

export const era_service_cycle_route = defineNode({
  "display_name": "选择收集事件或执行任务",
  "description": "读取服务当前阶段，选择收集新事件或处理已规划任务。阶段资料无效时报告流程问题，防止把收集状态误当成可执行批次。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.service.cycle.state","cardinality":"exactly_one","display_name":"服务当前处于收集还是执行及相应进度"}],"provides":[{"key":"cycle_route","type":"era.service.cycle.route","display_name":"本轮应收集事件还是执行任务"},{"key":"cycle_state_routed","type":"era.service.cycle.routed","display_name":"已选择阶段的服务状态"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.service.cycle.state":["收集时携带事件和计时，执行时携带批次任务与结果，供每轮选择对应处理。"]},"output_semantics":{"cycle_route":["根据当前服务阶段选择处理路径，避免混用两种进度。"],"cycle_state_routed":["交给收集或执行分支取出本轮需要的具体进度。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"RouteCycleNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["服务阶段循环"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.cycle.route",
  "node_type": "vibeflow.node"
});

export const era_service_cycle_unpack_collect = defineNode({
  "display_name": "取出本轮事件收集的进度",
  "description": "从服务状态中取出已等待的事件、当前事件序号及定时安排，供下一次事件合并使用。保持同一批收集过程的连续性。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.service.cycle.routed","cardinality":"exactly_one","display_name":"已选择阶段的服务状态"}],"provides":[{"key":"service_state_current","type":"era.service.state.current","display_name":"当前事件收集的服务状态"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.service.cycle.routed":["交给收集或执行分支取出本轮需要的具体进度。"]},"output_semantics":{"service_state_current":["供本轮读取事件、合并收集范围和建立下轮状态。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"UnpackCollectCycleNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["服务阶段循环"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.cycle.unpack_collect",
  "node_type": "vibeflow.node"
});

export const era_service_cycle_unpack_execution = defineNode({
  "display_name": "取出本轮任务执行的进度",
  "description": "从服务状态取出当前任务列表、执行位置、累计结果和消息处理进度。任务执行流程据此处理正确的一项，并延续已有成果。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.service.cycle.routed","cardinality":"exactly_one","display_name":"已选择阶段的服务状态"}],"provides":[{"key":"execution_state","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.service.cycle.routed":["交给收集或执行分支取出本轮需要的具体进度。"]},"output_semantics":{"execution_state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"UnpackExecutionCycleNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["服务阶段循环"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.cycle.unpack_execution",
  "node_type": "vibeflow.node"
});

export const era_tasks_dispatch = defineNode({
  "display_name": "选择标识、设置或忽略任务的处理方式",
  "description": "接收已准备的简单任务，按种类交给消息标识确认、生成设置管理或忽略事件处理。选定分支产生一个任务结果，供批次汇总。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"},{"type":"era.task.route.selected","cardinality":"exactly_one","display_name":"已选中的简单任务处理种类"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"simple_task_route","type":"era.task.route","display_name":"本次任务应进入的业务流程"},{"key":"routed_step_for_task","type":"era.step.request.routed","display_name":"当前任务及已读取的聊天资料"},{"key":"execution_state_for_task","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"era.task.route.selected":["指明消息标识、生成设置或忽略事件，供对应执行分支。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"simple_task_route":["标明历史同步、消息标识、生成设置或忽略等已选择方向，供后续执行对应处理。"],"routed_step_for_task":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"execution_state_for_task":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"DispatchTaskNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["步骤执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.tasks.dispatch",
  "node_type": "vibeflow.node"
});

export const era_service_begin = defineNode({
  "display_name": "建立服务进度并开始收集事件",
  "description": "建立事件等待集合、定时安排、批次计数和消息处理进度，从收集事件阶段启动服务。后续聊天变化和脚本请求会按批次进入统一处理。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[],"provides":[{"key":"cycle_state_initial","type":"era.service.cycle.state","display_name":"服务当前处于收集还是执行及相应进度"}],"params_schema":{},"params_defaults":{},"input_semantics":{},"output_semantics":{"cycle_state_initial":["收集时携带事件和计时，执行时携带批次任务与结果，供每轮选择对应处理。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"BeginServiceNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["服务任务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.begin",
  "node_type": "vibeflow.node"
});

export const era_service_finalize_batch = defineNode({
  "display_name": "为整批原事件形成最终处理确认",
  "description": "汇总当前批次所有任务的实际结果，为每个原事件形成一次最终确认，并更新完成批次数。后续统一把确认和页面通知送回酒馆。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.batch.execution.state.after","cardinality":"exactly_one","display_name":"本批任务结束或计划失败后的状态"}],"provides":[{"key":"batch_finalization","type":"era.batch.finalization","display_name":"整批已完成任务的汇总结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.batch.execution.state.after":["供最终汇总原事件结论，并形成下一轮服务状态。"]},"output_semantics":{"batch_finalization":["包括逐事件确认和通知，供组装发回页面的结果。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"FinalizeBatchNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["批次执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.finalize_batch",
  "node_type": "vibeflow.node"
});

export const era_service_merge_task_result = defineNode({
  "display_name": "合并当前任务结果并移到下一项",
  "description": "将刚完成任务的处理确认、问题记录、通知和消息进度加入批次累计结果。推进任务位置并标记是否完成，让服务选择继续下一项还是汇总整批。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.task.result","cardinality":"exactly_one","display_name":"本项任务对应原事件的处理结果"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"execution_state_next","type":"era.batch.execution.state.next","display_name":"合入当前任务后的下一执行进度"},{"key":"step_done","type":"era.step.done","display_name":"当前处理范围是否已经结束"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.task.result":["包含实际成功、无变化、失败或取消，以及通知和问题说明，供批次集中回告发起者。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"execution_state_next":["包含累积结果及推进后的任务位置，供批次继续或结算。"],"step_done":["循环据此继续下一消息、操作或任务，或进入本范围的最终结果整理。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/iteration/shared_protocol_adapters.ts","export":"MergeTaskResultNode"}}],
  "base_libs": ["era.service.service_protocol_collection","era.service.service_protocol_execution"],
  "capabilities": [],
  "tags": ["步骤执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.merge_task_result",
  "node_type": "vibeflow.node"
});
