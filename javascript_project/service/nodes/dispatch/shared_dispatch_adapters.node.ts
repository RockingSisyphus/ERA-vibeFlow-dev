import {defineNode} from "@vibeflow/plugin";

export const era_dispatch_build_no_host_context = defineNode({
  "display_name": "为无需读取聊天的任务保留请求资料",
  "description": "对已决定忽略或本来不需要聊天资料的任务，直接准备执行所需的原请求和事件来源。后续可以返回对应处理确认，避免为了空任务读取整份聊天。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.dispatch.seed","cardinality":"exactly_one","display_name":"任务资料准备的输入依据"}],"provides":[{"key":"no_host_outcome","type":"era.dispatch.preparation.outcome","display_name":"任务资料准备和必要写入的结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.dispatch.seed":["保留任务种类、来源和要求读取的范围，供准备聊天上下文。"]},"output_semantics":{"no_host_outcome":["包含准备好的正文、内部记录、实际写入结论和问题，供形成任务执行资料。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/dispatch/shared_dispatch_adapters.ts","export":"BuildNoHostContextNode"}}],
  "base_libs": ["era.service.dispatch_preparation","era.service.types"],
  "tags": ["任务派发"],
  "rulesets": ["vibeflow.process"],
  "id": "era.dispatch.build_no_host_context",
  "node_type": "vibeflow.node"
});

export const era_dispatch_classify_context = defineNode({
  "display_name": "判断当前任务要读取哪类资料",
  "description": "根据任务种类，选择读取初始化资源、消息历史、消息标识或脚本接口需要的聊天资料。无需聊天资料时走直接准备分支，确保后续读取服务于本次实际任务。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.step.request","cardinality":"exactly_one","display_name":"当前批次选出的下一项任务"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"}],"provides":[{"key":"dispatch_seed","type":"era.dispatch.seed","display_name":"任务资料准备的输入依据"},{"key":"context_route","type":"era.dispatch.context.route","display_name":"当前任务需要读取的资料种类"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.step.request":["记录将要处理的任务和事件来源，随后会读取相应聊天资料并选择业务流程。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"]},"output_semantics":{"dispatch_seed":["保留任务种类、来源和要求读取的范围，供准备聊天上下文。"],"context_route":["用于选择初始化资源、同步、消息标识或接口资料的读取路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/dispatch/shared_dispatch_adapters.ts","export":"ClassifyContextNode"}}],
  "base_libs": ["era.service.dispatch_preparation","era.service.types"],
  "tags": ["任务派发"],
  "rulesets": ["vibeflow.process"],
  "id": "era.dispatch.classify_context",
  "node_type": "vibeflow.node"
});

export const era_dispatch_finalize_context = defineNode({
  "display_name": "交出当前任务已确认的执行资料",
  "description": "汇总读取到的聊天、准备中的正文修改和实际写入结果，形成初始化、变量提交、生成或普通同步所需的完整资料。执行流程据此使用一致的消息身份和历史范围。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.dispatch.preparation.outcome","cardinality":"exactly_one","display_name":"任务资料准备和必要写入的结果"}],"provides":[{"key":"prepared_routed_step","type":"era.step.request.routed","display_name":"当前任务及已读取的聊天资料"},{"key":"prepared_task_route","type":"era.task.route","display_name":"本次任务应进入的业务流程"},{"key":"task_family_route","type":"era.task.family.route","display_name":"当前任务所属的业务种类"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.dispatch.preparation.outcome":["包含准备好的正文、内部记录、实际写入结论和问题，供形成任务执行资料。"]},"output_semantics":{"prepared_routed_step":["包含本批正在处理的任务、它对应的原事件和已确认聊天资料，供选定的业务流程执行并返回结果。"],"prepared_task_route":["标明历史同步、消息标识、生成设置或忽略等已选择方向，供后续执行对应处理。"],"task_family_route":["标明初始化、接口、生成或普通任务，供形成相应执行资料。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/dispatch/shared_dispatch_adapters.ts","export":"FinalizeDispatchContextNode"}}],
  "base_libs": ["era.service.dispatch_preparation","era.service.types"],
  "tags": ["任务派发"],
  "rulesets": ["vibeflow.process"],
  "id": "era.dispatch.finalize_context",
  "node_type": "vibeflow.node"
});

export const era_dispatch_plan_message_preparation = defineNode({
  "display_name": "为消息补齐历史标识和显示位置",
  "description": "接收目标消息、内部记录和状态栏设置，为消息准备关联变量历史的身份标识及必要的显示占位。普通同步暂存正文变化，单独标识任务形成写入计划，供后续统一处理。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.dispatch.canonical_context","cardinality":"exactly_one","display_name":"当前任务统一读取到的聊天上下文"}],"provides":[{"key":"dispatch_preparation_plan","type":"era.dispatch.preparation.plan","display_name":"任务需要的消息标识及待写入内容"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.dispatch.canonical_context":["包含目标消息、回复、文件绑定及相关设置，供确定处理范围和准备改动。"]},"output_semantics":{"dispatch_preparation_plan":["记录根据真实消息准备的历史身份和显示占位改动，供保留到统一保存或直接提交。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/dispatch/shared_dispatch_adapters.ts","export":"PlanMessagePreparationNode"}}],
  "base_libs": ["era.service.dispatch_preparation","era.service.types"],
  "tags": ["任务派发"],
  "rulesets": ["vibeflow.process"],
  "id": "era.dispatch.plan_message_preparation",
  "node_type": "vibeflow.node"
});

export const era_dispatch_preserve_prepared_context = defineNode({
  "display_name": "保留任务已准备的正文及读取结果",
  "description": "接收已准备的消息正文、内部记录和待保存内容，连同读取问题一起继续传递。后续任务可以沿用同一份资料，知道哪些内容待保存、哪些读取已经失败。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.dispatch.preparation.plan","cardinality":"exactly_one","display_name":"任务需要的消息标识及待写入内容"}],"provides":[{"key":"preserved_preparation_outcome","type":"era.dispatch.preparation.outcome","display_name":"任务资料准备和必要写入的结果"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.dispatch.preparation.plan":["记录根据真实消息准备的历史身份和显示占位改动，供保留到统一保存或直接提交。"]},"output_semantics":{"preserved_preparation_outcome":["包含准备好的正文、内部记录、实际写入结论和问题，供形成任务执行资料。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/dispatch/shared_dispatch_adapters.ts","export":"PreservePreparedContextNode"}}],
  "base_libs": ["era.service.dispatch_preparation","era.service.types"],
  "tags": ["任务派发"],
  "rulesets": ["vibeflow.process"],
  "id": "era.dispatch.preserve_prepared_context",
  "node_type": "vibeflow.node"
});
