import {defineNode} from "@vibeflow/plugin";

export const era_agent_candidate_finish = defineNode({
  "display_name": "判断生成尝试结束还是需要重试",
  "description": "检查本次模型输出及指令应用后的结论。有可执行的重试要求时带着现有进度进入下一尝试，否则交出最终成功、取消或失败结果，供生成阶段结算。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.agent.candidate.state","cardinality":"exactly_one","display_name":"本次生成尝试的请求和恢复起点"},{"type":"era.agent.generation.outcome","cardinality":"exactly_one","display_name":"本次生成及指令应用后的结论"}],"provides":[{"key":"candidate_state_after","type":"era.agent.candidate.state.next","display_name":"本次尝试后的进度与重试要求"},{"key":"candidate_done","type":"era.agent.candidate.done","display_name":"本次生成尝试循环是否结束"},{"key":"candidate_outcome","type":"era.agent.candidate.outcome","display_name":"生成尝试结束后的完整结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.candidate.state":["记录本次模型尝试的请求、原任务及出错后应恢复的状态，供生成、指令应用和允许的重试共同使用。"],"era.agent.generation.outcome":["包含生成阶段实际结果、已应用指令情况及下一步安排，供阶段交接和任务结算使用。"]},"output_semantics":{"candidate_state_after":["未结束时作为下一次生成的起点，结束时供交出最终生成结果。"],"candidate_done":["说明本阶段已经成功、取消或无法再重试，供循环停止判断。"],"candidate_outcome":["记录生成及文字指令处理的最终结论，供后续整理阶段交接和原请求确认。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_pure_adapters.ts","export":"CandidateFinishNode"}}],
  "base_libs": [],
  "tags": ["Agent候选"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.candidate_finish",
  "node_type": "vibeflow.node"
});

export const era_agent_candidate_unpack = defineNode({
  "display_name": "取出下一次模型生成需要的请求",
  "description": "从当前生成尝试的状态中，取出模型请求、原任务和所属批次。下一次模型调用据此继续，确保重试仍属于同一次生成任务。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.agent.candidate.state","cardinality":"exactly_one","display_name":"本次生成尝试的请求和恢复起点"}],"provides":[{"key":"generation_request","type":"era.agent.generation.request","display_name":"本次模型生成要求与聊天起点"},{"key":"routed_step","type":"era.step.request.routed","display_name":"当前任务及已读取的聊天资料"},{"key":"execution_state","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.candidate.state":["记录本次模型尝试的请求、原任务及出错后应恢复的状态，供生成、指令应用和允许的重试共同使用。"]},"output_semantics":{"generation_request":["包含当前生成阶段、模型设置、提示资料及所属聊天，供本次模型调用和文字指令处理使用。"],"routed_step":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"execution_state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_pure_adapters.ts","export":"CandidateUnpackNode"}}],
  "base_libs": [],
  "tags": ["Agent候选"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.candidate_unpack",
  "node_type": "vibeflow.node"
});


export const era_service_route_fatal = defineNode({
  "display_name": "判断返回结果后是否必须停止服务",
  "description": "检查已发送给页面的批次结果是否含有严重停止原因。有则结束本实例服务，没有则继续收集事件，确保调用方先收到处理结果，再进入相应后续状态。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.batch.fatal","cardinality":"exactly_one","display_name":"本批是否存在必须停止的严重问题"}],"provides":[{"key":"fatal_route","type":"era.fatal.route","display_name":"回告结果后继续服务还是停止"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.batch.fatal":["记录无法安全继续服务的原因，供先回告原事件再结束服务。"]},"output_semantics":{"fatal_route":["说明当前已发布结论要求恢复收集事件，还是结束实例执行。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_pure_adapters.ts","export":"RouteFatalNode"}}],
  "base_libs": [],
  "tags": ["批次发布"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.route_fatal",
  "node_type": "vibeflow.node"
});

export const era_service_adapt_api_task_result = defineNode({
  "display_name": "把接口处理结果纳入当前批次",
  "description": "接收脚本或界面请求的实际处理结果，将成功、跳过、失败及相关说明整理为批次可汇总的形式。保留对应请求的处理确认，供统一向页面返回。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.api.task.result","cardinality":"exactly_one","display_name":"脚本接口任务产生的处理结果"}],"provides":[{"key":"api_task_result_common","type":"era.task.result","display_name":"本项任务对应原事件的处理结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.api.task.result":["保留接口约定的实际结果，供转换为批次通用确认并回告。"]},"output_semantics":{"api_task_result_common":["包含实际成功、无变化、失败或取消，以及通知和问题说明，供批次集中回告发起者。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_pure_adapters.ts","export":"AdaptApiTaskResultNode"}}],
  "base_libs": [],
  "tags": ["公共 Facade"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.adapt_api_task_result",
  "node_type": "vibeflow.node"
});

export const era_service_terminal = defineNode({
  "display_name": "标记服务流程的开始或结束",
  "description": "标明 ERA 服务或其子流程的开始、结束位置，帮助查看执行顺序。实际任务处理和结果返回由图中的业务步骤完成。",
  "version": "1.0.0",
  "flow_kind": "terminal",
  "contract": {"requires":[],"provides":[],"params_schema":{},"params_defaults":{},"input_semantics":{},"output_semantics":{}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_pure_adapters.ts","export":"TerminalNode"}}],
  "base_libs": [],
  "tags": ["服务生命周期"],
  "rulesets": ["vibeflow.process"],
  "id": "era.service.terminal",
  "node_type": "vibeflow.node"
});

export const era_agent_route_transition = defineNode({
  "display_name": "选择生成结果后续的处理流程",
  "description": "接收生成阶段结论，判断还需历史同步、消息标识确认，还是直接返回阶段结果。将本次请求引向相应分支，使保存与处理确认沿统一流程完成。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.agent.session.transition","cardinality":"exactly_one","display_name":"生成后需要继续的消息处理"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"agent_route","type":"era.agent.session.route","display_name":"生成结果后续应走的方向"},{"key":"agent_transition_routed","type":"era.agent.session.transition","display_name":"生成后需要继续的消息处理"},{"key":"agent_execution_state_routed","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.session.transition":["记录生成阶段是否还需历史同步、消息标识确认或直接返回，供外层选择相应流程。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"agent_route":["标明历史同步、消息标识或直接返回，供统一消息结算使用。"],"agent_transition_routed":["记录生成阶段是否还需历史同步、消息标识确认或直接返回，供外层选择相应流程。"],"agent_execution_state_routed":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_pure_adapters.ts","export":"RouteTransitionNode"}}],
  "base_libs": [],
  "tags": ["故事生成会话"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.route_transition",
  "node_type": "vibeflow.node"
});

export const era_installation_scope_choose_startup = defineNode({
  "display_name": "按脚本安装位置决定启用或休眠",
  "description": "比较当前脚本在角色卡、全局或预设中的启用位置，决定该实例运行服务还是显示休眠提示。位置无法识别时按现有兼容规则启动并给出诊断，让后续使用明确的启用范围。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.installation.scope.facts","cardinality":"exactly_one","display_name":"当前脚本及各安装位置的启用情况"}],"provides":[{"key":"installation_scope_decision","type":"era.installation.scope.decision","display_name":"脚本启用范围和启动说明"},{"key":"installation_scope_route","type":"era.installation.scope.route","display_name":"当前实例应启用还是休眠"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.installation.scope.facts":["来自酒馆的真实脚本资料，供主服务判断启用或休眠。"]},"output_semantics":{"installation_scope_decision":["说明当前实例应运行哪些业务或保持休眠，以及对应安装位置和原因。"],"installation_scope_route":["决定继续连接聊天与界面，或显示休眠说明并结束本次启动。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_pure_adapters.ts","export":"ChooseStartupNode"}}],
  "base_libs": [],
  "tags": ["服务任务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.installation.scope.choose_startup",
  "node_type": "vibeflow.node"
});

export const era_initialize_adapt_startup_sync_step = defineNode({
  "display_name": "整理初始化后的历史同步任务",
  "description": "接收初始化已经准备好的启动同步要求，转换为统一消息同步可执行的任务。保留原批次和事件来源，让资源准备与变量恢复属于同一次启动请求。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.initialize.startup.sync.step","cardinality":"exactly_one","display_name":"资源就绪后需要执行的历史同步"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"routed_startup_sync_step","type":"era.step.request.routed","display_name":"当前任务及已读取的聊天资料"},{"key":"routed_startup_execution_state","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.initialize.startup.sync.step":["将原初始化请求接入统一消息同步，供恢复当前聊天变量。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"routed_startup_sync_step":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"routed_startup_execution_state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_pure_adapters.ts","export":"AdaptStartupSyncStepNode"}}],
  "base_libs": [],
  "tags": ["初始化事务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.initialize.adapt_startup_sync_step",
  "node_type": "vibeflow.node"
});

export const era_initialize_build_commit = defineNode({
  "display_name": "把初始化变更计划交给酒馆执行",
  "description": "接收已规划的 ERA 资源变化，整理成明确的写入请求。浏览器执行环节据此逐项更新资源并报告结果，本环节仍处于提交前的准备阶段。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.initialize.changes","cardinality":"exactly_one","display_name":"已经比较出的资源变化或无变化结论"}],"provides":[{"key":"resource_commit_request","type":"era.initialize.commit.request","display_name":"需要实际安装或修改的资源计划"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.initialize.changes":["供写入请求组装沿用现有计划，实际保存仍在执行环节完成。"]},"output_semantics":{"resource_commit_request":["包含明确的设置、世界书、正则和开场白改动，供酒馆逐项执行。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_pure_adapters.ts","export":"BuildInitializationCommitNode"}}],
  "base_libs": [],
  "tags": ["初始化事务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.initialize.build_commit",
  "node_type": "vibeflow.node"
});

export const era_initialize_carry_execution_state = defineNode({
  "display_name": "记住初始化请求所属的批次",
  "description": "让原初始化任务和批次资料随资源准备流程继续传递。资源完成后用这些资料继续历史同步，并把最终结果返回原发起者。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"initialize_execution_state","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"initialize_execution_state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_pure_adapters.ts","export":"CarryExecutionStateNode"}}],
  "base_libs": [],
  "tags": ["初始化事务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.initialize.carry_execution_state",
  "node_type": "vibeflow.node"
});

export const era_initialize_compute = defineNode({
  "display_name": "传递已准备的初始化计划",
  "description": "接收已经生成的资源初始化计划，原样交给写入请求组装环节。保留其中需要修改或不能执行的结论，使下一步使用同一份计划。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.initialize.plan","cardinality":"exactly_one","display_name":"尚待执行的初始化资源变更"}],"provides":[{"key":"computed_resource_changes","type":"era.initialize.changes","display_name":"已经比较出的资源变化或无变化结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.initialize.plan":["描述拟修改哪些 ERA 资源以及准备问题，实际完成情况由后续执行确认。"]},"output_semantics":{"computed_resource_changes":["供写入请求组装沿用现有计划，实际保存仍在执行环节完成。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_pure_adapters.ts","export":"ComputeInitializationNode"}}],
  "base_libs": [],
  "tags": ["初始化规划"],
  "rulesets": ["vibeflow.process"],
  "id": "era.initialize.compute",
  "node_type": "vibeflow.node"
});

export const era_initialize_finalize_direct_result = defineNode({
  "display_name": "完成只处理资源的初始化任务",
  "description": "接收不再需要启动历史同步的资源操作结果，整理为本次初始化任务的处理确认。交给批次结算，保留实际成功或失败状态。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.initialize.direct.result","cardinality":"exactly_one","display_name":"无需继续同步的初始化结论"}],"provides":[{"key":"initialize_direct_task_result","type":"era.task.result","display_name":"本项任务对应原事件的处理结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.initialize.direct.result":["供本次只操作资源或发生失败时直接向原任务回告。"]},"output_semantics":{"initialize_direct_task_result":["包含实际成功、无变化、失败或取消，以及通知和问题说明，供批次集中回告发起者。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_pure_adapters.ts","export":"FinalizeDirectInitializationNode"}}],
  "base_libs": [],
  "tags": ["初始化事务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.initialize.finalize_direct_result",
  "node_type": "vibeflow.node"
});

export const era_initialize_no_change = defineNode({
  "display_name": "保留无需修改或无法准备的资源结果",
  "description": "当前资源已经满足要求，或准备阶段已经失败时，将相应计划和原因交给后续结算。让初始化能够准确返回无变化或失败结果。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.initialize.plan","cardinality":"exactly_one","display_name":"尚待执行的初始化资源变更"}],"provides":[{"key":"preserved_resource_changes","type":"era.initialize.changes","display_name":"已经比较出的资源变化或无变化结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.initialize.plan":["描述拟修改哪些 ERA 资源以及准备问题，实际完成情况由后续执行确认。"]},"output_semantics":{"preserved_resource_changes":["供写入请求组装沿用现有计划，实际保存仍在执行环节完成。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_pure_adapters.ts","export":"PreserveInitializationNode"}}],
  "base_libs": [],
  "tags": ["初始化规划"],
  "rulesets": ["vibeflow.process"],
  "id": "era.initialize.no_change",
  "node_type": "vibeflow.node"
});

