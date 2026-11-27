import {defineNode} from "@vibeflow/plugin";

export const era_initialize_prepare_resource_result = defineNode({
  "display_name": "整理无需继续同步的初始化结果",
  "description": "接收资源操作的成功值或错误，连同原事件交给初始化任务结算。用于本次只处理资源、或因问题不能继续启动历史同步的情况。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.initialize.direct.result","cardinality":"exactly_one","display_name":"无需继续同步的初始化结论"},{"type":"era.task.continuation.context","cardinality":"exactly_one","display_name":"执行后回告所需的原任务资料"}],"provides":[{"key":"prepare_resource_result_prepared_task","type":"era.task.prepared","display_name":"已备齐的执行请求或直接返回结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.initialize.direct.result":["供本次只操作资源或发生失败时直接向原任务回告。"],"era.task.continuation.context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]},"output_semantics":{"prepare_resource_result_prepared_task":["说明当前任务可执行的请求及所需资料，或已经确定的无变化、失败等结果，供执行选择使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_initialization_adapters.ts","export":"prepareResourceResult"}}],
  "base_libs": ["era.service.initialization_transaction","era.service.task_continuation","era.service.types"],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.initialize.prepare_resource_result",
  "node_type": "vibeflow.node"
});

export const era_initialize_prepare_startup_continuation = defineNode({
  "display_name": "把资源就绪后的聊天交给历史同步",
  "description": "ERA 所需资源已经准备好时，取出启动后的历史同步请求和原任务批次。让统一同步流程接着计算现有聊天中的变量，并保留原启动请求以便返回结果。",
  "version": "1.0.0",
  "flow_kind": "process",
  "contract": {"requires":[{"type":"era.initialize.startup.sync.step","cardinality":"exactly_one","display_name":"资源就绪后需要执行的历史同步"},{"type":"era.batch.execution.state","cardinality":"exactly_one","display_name":"当前批次的任务进度与累计结果"},{"type":"era.task.continuation.context","cardinality":"exactly_one","display_name":"执行后回告所需的原任务资料"}],"provides":[{"key":"prepare_startup_continuation_prepared_task","type":"era.task.prepared","display_name":"已备齐的执行请求或直接返回结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.initialize.startup.sync.step":["将原初始化请求接入统一消息同步，供恢复当前聊天变量。"],"era.batch.execution.state":["记录本批有序任务、当前执行位置、已有处理确认和消息进度，任务完成后会继续合入同一批次。"],"era.task.continuation.context":["保留原任务、事件来源和所属批次，使各类执行结果最终能回到正确请求。"]},"output_semantics":{"prepare_startup_continuation_prepared_task":["说明当前任务可执行的请求及所需资料，或已经确定的无变化、失败等结果，供执行选择使用。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_initialization_adapters.ts","export":"prepareStartupContinuation"}}],
  "base_libs": ["era.service.initialization_transaction","era.service.task_continuation","era.service.types"],
  "tags": ["核心执行"],
  "rulesets": ["vibeflow.process"],
  "id": "era.initialize.prepare_startup_continuation",
  "node_type": "vibeflow.node"
});

export const era_initialize_build_result = defineNode({
  "display_name": "决定初始化后继续同步还是返回结果",
  "description": "检查资源初始化的实际结论。资源就绪或本来无需修改时继续历史同步，其余情况交出当前操作结果，避免资源未准备好就继续处理聊天。",
  "version": "1.1.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.initialize.commit.result","cardinality":"exactly_one","display_name":"初始化资源的真实写入进度和结论"}],"provides":[{"key":"initialize_completion_route","type":"era.initialize.completion.route","display_name":"初始化后继续同步或直接结束"},{"key":"startup_sync_step","type":"era.initialize.startup.sync.step","display_name":"资源就绪后需要执行的历史同步"},{"key":"initialize_direct_result","type":"era.initialize.direct.result","display_name":"无需继续同步的初始化结论"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.initialize.commit.result":["记录哪些改动已经完成、哪些失败，供决定后续同步或返回原因。"]},"output_semantics":{"initialize_completion_route":["根据资源操作实际结果决定进入启动同步，还是返回已有任务结论。"],"startup_sync_step":["将原初始化请求接入统一消息同步，供恢复当前聊天变量。"],"initialize_direct_result":["供本次只操作资源或发生失败时直接向原任务回告。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_initialization_adapters.ts","export":"FinalizeInitializationNode"}}],
  "base_libs": ["era.service.initialization_transaction","era.service.task_continuation","era.service.types"],
  "tags": ["初始化事务"],
  "rulesets": ["vibeflow.process"],
  "id": "era.initialize.build_result",
  "node_type": "vibeflow.node"
});

export const era_initialize_plan = defineNode({
  "display_name": "比较现有资源并规划 ERA 初始化",
  "description": "读取当前设置、世界书、状态栏正则、示例变量、函数和开场白，找出启用 ERA 需要的改动。按所选使用模式准备内容，并保留已有作者资料；这里只形成计划，实际写入交给执行环节。",
  "version": "1.0.0",
  "flow_kind": "decision",
  "contract": {"requires":[{"type":"era.initialize.context","cardinality":"exactly_one","display_name":"初始化读取到的当前角色资源"}],"provides":[{"key":"initialization_route","type":"era.initialize.route","display_name":"资源有改动还是可以沿用"},{"key":"initialization_plan","type":"era.initialize.plan","display_name":"尚待执行的初始化资源变更"}],"params_schema":{},"params_defaults":{},"input_semantics":{"era.initialize.context":["记录现有设置、世界书、正则、开场白和使用模式，供比较所需改动。"]},"output_semantics":{"initialization_route":["用于选择需要组装写入计划，或传递无变化与失败结果。"],"initialization_plan":["描述拟修改哪些 ERA 资源以及准备问题，实际完成情况由后续执行确认。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/initialize/shared_initialization_adapters.ts","export":"PlanInitializationNode"}}],
  "base_libs": ["era.service.initialization_transaction","era.service.task_continuation","era.service.types"],
  "tags": ["初始化规划"],
  "rulesets": ["vibeflow.process"],
  "id": "era.initialize.plan",
  "node_type": "vibeflow.node"
});

