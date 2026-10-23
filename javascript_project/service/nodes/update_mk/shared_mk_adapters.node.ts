import {defineNode} from "@vibeflow/plugin";

export const era_agent_adapt_legacy_step = defineNode({
  "display_name": "让生成后的消息继续统一历史处理",
  "description": "将生成结束后的消息处理要求整理为普通历史同步或消息标识任务。保留消息位置、原事件和所属批次，让生成内容沿同一套消息流程完成后续结算。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.agent.session.transition","cardinality":"exactly_one","display_name":"生成后需要继续的消息处理"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"legacy_routed_step","type":"era.step.request.routed","display_name":"当前任务及已读取的聊天资料"},{"key":"legacy_task_route","type":"era.task.route","display_name":"本次任务应进入的业务流程"},{"key":"legacy_execution_state","type":"era.batch.execution.state","display_name":"当前批次的任务进度与累计结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.agent.session.transition":["记录生成阶段是否还需历史同步、消息标识确认或直接返回，供外层选择相应流程。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"legacy_routed_step":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"legacy_task_route":["标明历史同步、消息标识、生成设置或忽略等已选择方向，供后续执行对应处理。"],"legacy_execution_state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/update_mk/shared_mk_adapters.ts","export":"AdaptLegacyStepNode"}}],
  "base_libs": ["era.service.types"],
  "capabilities": [],
  "tags": ["故事生成会话"],
  "rulesets": ["vibeflow.process"],
  "id": "era.agent.adapt_legacy_step",
  "node_type": "vibeflow.node"
});

export const era_mk_build_commit = defineNode({
  "display_name": "整理需要保存的消息标识改动",
  "description": "接收已确认有效的消息标识及正文、内部记录变化，形成明确写入请求。必要资料缺失时返回具体错误，供后续避免提交不完整内容。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.mk.candidate.routed","cardinality":"exactly_one","display_name":"已选保存方向的消息标识资料"}],"provides":[{"key":"mk_commit_request","type":"era.mk.commit.request","display_name":"需要保存的消息身份和正文改动"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.mk.candidate.routed":["供标识保存、无变化或失败分支使用同一份消息修改依据。"]},"output_semantics":{"mk_commit_request":["供向酒馆明确提交相应正文及内部历史记录。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/update_mk/shared_mk_adapters.ts","export":"BuildMkCommitNode"}}],
  "base_libs": ["era.service.types"],
  "capabilities": [],
  "tags": ["消息密钥纯计算"],
  "rulesets": ["vibeflow.process"],
  "id": "era.mk.build_commit",
  "node_type": "vibeflow.node"
});

export const era_mk_build_result = defineNode({
  "display_name": "向原事件返回消息标识处理结果",
  "description": "根据消息标识准备和实际保存结论，为每个原事件形成一次成功、无变化、取消或失败确认。附上问题说明，供批次汇总及调用方获知结果。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.mk.commit.result","cardinality":"exactly_one","display_name":"消息身份准备和实际保存的结果"}],"provides":[{"key":"update_mk_task_result","type":"era.task.result","display_name":"本项任务对应原事件的处理结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.mk.commit.result":["保留是否变化、哪些写入已确认及失败原因，供向原事件返回处理确认。"]},"output_semantics":{"update_mk_task_result":["包含实际成功、无变化、失败或取消，以及通知和问题说明，供批次集中回告发起者。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/update_mk/shared_mk_adapters.ts","export":"BuildMkResultNode"}}],
  "base_libs": ["era.service.types"],
  "capabilities": [],
  "tags": ["消息密钥结果"],
  "rulesets": ["vibeflow.process"],
  "id": "era.mk.build_result",
  "node_type": "vibeflow.node"
});

export const era_mk_consume_prepared = defineNode({
  "display_name": "读取任务准备时已有的消息标识结果",
  "description": "取出任务准备阶段已经生成的消息标识、显示占位和实际写入结论。将这些已有成果交给标识任务结算，避免重复计算和保存。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.step.request.routed","cardinality":"exactly_one","display_name":"当前任务及已读取的聊天资料"}],"provides":[{"key":"prepared_mk_outcome","type":"era.mk.commit.result","display_name":"消息身份准备和实际保存的结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request.routed":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"]},"output_semantics":{"prepared_mk_outcome":["保留是否变化、哪些写入已确认及失败原因，供向原事件返回处理确认。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/update_mk/shared_mk_adapters.ts","export":"ConsumePreparedContextNode"}}],
  "base_libs": ["era.service.types"],
  "capabilities": [],
  "tags": ["消息密钥"],
  "rulesets": ["vibeflow.process"],
  "id": "era.mk.consume_prepared",
  "node_type": "vibeflow.node"
});

export const era_mk_no_change = defineNode({
  "display_name": "保留消息标识无需修改或失败的结论",
  "description": "消息标识没有需要保存的变化，或准备已经失败时，继续传递原事件和具体原因。统一结算据此返回准确结果。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.mk.candidate.routed","cardinality":"exactly_one","display_name":"已选保存方向的消息标识资料"}],"provides":[{"key":"mk_noop_outcome","type":"era.mk.commit.result","display_name":"消息身份准备和实际保存的结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.mk.candidate.routed":["供标识保存、无变化或失败分支使用同一份消息修改依据。"]},"output_semantics":{"mk_noop_outcome":["保留是否变化、哪些写入已确认及失败原因，供向原事件返回处理确认。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/update_mk/shared_mk_adapters.ts","export":"PreserveMkNode"}}],
  "base_libs": ["era.service.types"],
  "capabilities": [],
  "tags": ["消息密钥结果"],
  "rulesets": ["vibeflow.process"],
  "id": "era.mk.no_change",
  "node_type": "vibeflow.node"
});
