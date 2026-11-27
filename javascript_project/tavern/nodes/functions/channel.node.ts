import {defineNode} from "@vibeflow/plugin";

export const era_tavern_function_submit_allocate_request = defineNode({
  "display_name": "为作者提出的操作建立结果等待",
  "description": "接收作者函数要提交的操作种类和内容，为它分配本次调用内的编号并保存结果等待。后续执行完成后能把相应处理确认返回给正确的一项请求。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.function_submit.check_call","cardinality":"exactly_one","display_name":"为作者提出的操作建立结果等待的请求和已有进度"}],"provides":[{"key":"era_tavern_function_submit_allocate_request_frame","type":"era.tavern.frame.function_submit.allocate_request","display_name":"为作者提出的操作建立结果等待的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_function_submit_allocate_request_frame"}},"input_semantics":{"era.tavern.frame.function_submit.check_call":["保留“为作者提出的操作建立结果等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_function_submit_allocate_request_frame":["保留“为作者提出的操作建立结果等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"AllocateRequest"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.function_submit.allocate_request",
  "node_type": "vibeflow.node"
});

export const era_tavern_function_submit_check_call = defineNode({
  "display_name": "确认作者函数仍可提交请求",
  "description": "根据函数参数或调用身份找到作者运行资料，按调用来源检查目标消息。读取上下文返回本次接口。提交操作还需确认作者函数仍在运行，结束后的新操作立即被拒绝。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"确认作者函数仍可提交请求的请求和已有进度"}],"provides":[{"key":"era_tavern_function_submit_check_call_frame","type":"era.tavern.frame.function_submit.check_call","display_name":"确认作者函数仍可提交请求的处理进度及结果"},{"key":"era_tavern_function_submit_check_call_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_function_submit_check_call_frame","route":"era_tavern_function_submit_check_call_route"}},"input_semantics":{"era.tavern.call.frame":["保留“确认作者函数仍可提交请求”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_function_submit_check_call_frame":["保留“确认作者函数仍可提交请求”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_function_submit_check_call_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"CheckSubmit"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.function_submit.check_call",
  "node_type": "vibeflow.node"
});

export const era_tavern_function_submit_enqueue_request = defineNode({
  "display_name": "把作者操作交给当前消息流程",
  "description": "将作者刚提出的变量提交等操作放入本次函数的请求队列，登记待确认记录并唤醒主服务等待。主服务可以在当前正文位置处理它，再回告函数结果。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.function_submit.allocate_request","cardinality":"exactly_one","display_name":"把作者操作交给当前消息流程的请求和已有进度"}],"provides":[{"key":"era_tavern_function_submit_enqueue_request_frame","type":"era.tavern.frame.function_submit.enqueue_request","display_name":"把作者操作交给当前消息流程的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_function_submit_enqueue_request_frame"}},"input_semantics":{"era.tavern.frame.function_submit.allocate_request":["保留“把作者操作交给当前消息流程”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_function_submit_enqueue_request_frame":["保留“把作者操作交给当前消息流程”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"EnqueueRequest"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.function_submit.enqueue_request",
  "node_type": "vibeflow.node"
});

export const era_tavern_function_submit_return_request = defineNode({
  "display_name": "交回作者接口或本次操作的等待结果",
  "description": "读取作者上下文时交出本次有效接口；提交操作时交出这项操作的结果等待。作者函数可以等到消息流程实际处理后继续执行。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.function_submit.check_call","cardinality":"all","display_name":"交回作者接口或本次操作的等待结果的请求和已有进度"},{"type":"era.tavern.frame.function_submit.enqueue_request","cardinality":"all","display_name":"交回作者接口或本次操作的等待结果的请求和已有进度"}],"provides":[{"key":"era_tavern_function_submit_return_request_frame","type":"era.tavern.frame.function_submit.return_request","display_name":"交回作者接口或本次操作的等待结果的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_function_submit_return_request_frame"}},"input_semantics":{"era.tavern.frame.function_submit.check_call":["保留“交回作者接口或本次操作的等待结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"],"era.tavern.frame.function_submit.enqueue_request":["保留“交回作者接口或本次操作的等待结果”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_function_submit_return_request_frame":["保留“交回作者接口或本次操作的等待结果”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"ReturnSubmit"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.function_submit.return_request",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_acknowledge_find_request = defineNode({
  "display_name": "找到作者正在等待确认的操作",
  "description": "根据作者调用身份和请求编号，找到本次尚未确认的操作。找不到时报告对应错误，找到后交给结果回告，避免确认到其他操作。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"找到作者正在等待确认的操作的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_acknowledge_find_request_frame","type":"era.tavern.frame.functions_acknowledge.find_request","display_name":"找到作者正在等待确认的操作的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_acknowledge_find_request_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“找到作者正在等待确认的操作”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_acknowledge_find_request_frame":["保留“找到作者正在等待确认的操作”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"FindRequest"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_acknowledge.find_request",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_acknowledge_resolve_request = defineNode({
  "display_name": "把操作处理结果回告作者函数",
  "description": "从待确认列表移除对应作者操作，把主服务实际处理的结论复制返回给函数。等待该操作的作者代码随后可以继续执行。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_acknowledge.find_request","cardinality":"exactly_one","display_name":"把操作处理结果回告作者函数的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_acknowledge_resolve_request_frame","type":"era.tavern.frame.functions_acknowledge.resolve_request","display_name":"把操作处理结果回告作者函数的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_acknowledge_resolve_request_frame"}},"input_semantics":{"era.tavern.frame.functions_acknowledge.find_request":["保留“把操作处理结果回告作者函数”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_acknowledge_resolve_request_frame":["保留“把操作处理结果回告作者函数”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"ResolveRequest"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_acknowledge.resolve_request",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_acknowledge_return_ack = defineNode({
  "display_name": "确认作者操作已回告完成",
  "description": "返回作者操作确认已交付的结果，供主服务继续消息处理。本环节承接已经完成的回告，不再执行变量操作。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_acknowledge.resolve_request","cardinality":"exactly_one","display_name":"确认作者操作已回告完成的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_acknowledge_return_ack_frame","type":"era.tavern.call.frame","display_name":"确认作者操作已回告完成的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_acknowledge_return_ack_frame"}},"input_semantics":{"era.tavern.frame.functions_acknowledge.resolve_request":["保留“确认作者操作已回告完成”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_acknowledge_return_ack_frame":["保留“确认作者操作已回告完成”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"ReturnAck"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_acknowledge.return_ack",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_begin_bind_context = defineNode({
  "display_name": "建立作者函数可用的参数和提交接口",
  "description": "为本次作者函数保存参数、目标消息及取消来源，并建立它可使用的变量提交接口。函数后续提出的操作会对应到这次调用，由消息流程逐项处理。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_begin.check_call","cardinality":"exactly_one","display_name":"建立作者函数可用的参数和提交接口的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_begin_bind_context_frame","type":"era.tavern.frame.functions_begin.bind_context","display_name":"建立作者函数可用的参数和提交接口的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_begin_bind_context_frame"}},"input_semantics":{"era.tavern.frame.functions_begin.check_call":["保留“建立作者函数可用的参数和提交接口”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_begin_bind_context_frame":["保留“建立作者函数可用的参数和提交接口”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"BindContext"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_begin.bind_context",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_begin_check_call = defineNode({
  "display_name": "检查作者函数调用身份和目标消息",
  "description": "接收准备启动的作者自定义 JavaScript 函数调用，确认调用身份尚未使用、请求未取消，且目标消息仍匹配。通过后才建立运行资料，避免旧消息中的函数误执行。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"检查作者函数调用身份和目标消息的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_begin_check_call_frame","type":"era.tavern.frame.functions_begin.check_call","display_name":"检查作者函数调用身份和目标消息的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_begin_check_call_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“检查作者函数调用身份和目标消息”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_begin_check_call_frame":["保留“检查作者函数调用身份和目标消息”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"CheckBegin"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_begin.check_call",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_begin_return_call = defineNode({
  "display_name": "确认作者函数已安排执行",
  "description": "返回本次作者函数已经启动安排的确认及调用身份。主服务据此进入后续请求等待，实际函数结果由作者执行及消息流程共同完成。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_begin.schedule_tool","cardinality":"exactly_one","display_name":"确认作者函数已安排执行的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_begin_return_call_frame","type":"era.tavern.call.frame","display_name":"确认作者函数已安排执行的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_begin_return_call_frame"}},"input_semantics":{"era.tavern.frame.functions_begin.schedule_tool":["保留“确认作者函数已安排执行”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_begin_return_call_frame":["保留“确认作者函数已安排执行”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"ReturnBegin"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_begin.return_call",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_begin_schedule_tool = defineNode({
  "display_name": "将作者函数加入按顺序执行的队列",
  "description": "接收已建立运行资料的作者函数，把它交给本实例的作者执行队列并唤醒等待者。作者执行分支按顺序运行，主服务仍可协作处理函数提出的变量提交。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_begin.bind_context","cardinality":"exactly_one","display_name":"将作者函数加入按顺序执行的队列的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_begin_schedule_tool_frame","type":"era.tavern.frame.functions_begin.schedule_tool","display_name":"将作者函数加入按顺序执行的队列的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_begin_schedule_tool_frame"}},"input_semantics":{"era.tavern.frame.functions_begin.bind_context":["保留“将作者函数加入按顺序执行的队列”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_begin_schedule_tool_frame":["保留“将作者函数加入按顺序执行的队列”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"ScheduleTool"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_begin.schedule_tool",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_next_check_active = defineNode({
  "display_name": "确认作者调用仍属于当前消息",
  "description": "读取主服务要继续等待的作者函数，检查调用仍有效、未取消且消息来源未变化。通过后再读取请求或完成状态，防止接续过期函数。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"确认作者调用仍属于当前消息的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_next_check_active_frame","type":"era.tavern.call.frame","display_name":"确认作者调用仍属于当前消息的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_next_check_active_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“确认作者调用仍属于当前消息”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_next_check_active_frame":["保留“确认作者调用仍属于当前消息”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"CheckNext"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_next.check_active",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_next_finish_choose_ready = defineNode({
  "display_name": "判断作者结果已取得还是继续等待",
  "description": "查看同步检查是否已拿到作者请求或结束结果。已经取得时直接交出，没有则进入等待循环，保持一次等待只返回当前实际结果。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"判断作者结果已取得还是继续等待的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_next_finish_choose_ready_frame","type":"era.tavern.call.frame.next_state","display_name":"判断作者结果已取得还是继续等待的处理进度及结果"},{"key":"era_tavern_functions_next_finish_choose_ready_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_next_finish_choose_ready_frame","route":"era_tavern_functions_next_finish_choose_ready_route"}},"input_semantics":{"era.tavern.call.frame":["保留“判断作者结果已取得还是继续等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_next_finish_choose_ready_frame":["保留“判断作者结果已取得还是继续等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_functions_next_finish_choose_ready_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"ChooseReady"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_next_finish.choose_ready",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_next_wait_request_item_await_wake = defineNode({
  "display_name": "登记等待作者下一步的唤醒",
  "description": "当前没有请求且函数尚未结束时，建立一次唤醒等待，供作者提交操作或运行结束时通知。外层循环等待后重新检查实际状态。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_next_wait_request_item.chosen","cardinality":"exactly_one","display_name":"登记等待作者下一步的唤醒的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_next_wait_request_item_await_wake_frame","type":"era.tavern.frame.functions_next_wait_request_item.result","display_name":"登记等待作者下一步的唤醒的处理进度及结果"},{"key":"era_tavern_functions_next_wait_request_item_await_wake_done","type":"era.tavern.done.functions_next.wait_request","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_next_wait_request_item_await_wake_frame","done":"era_tavern_functions_next_wait_request_item_await_wake_done"}},"input_semantics":{"era.tavern.frame.functions_next_wait_request_item.chosen":["保留“登记等待作者下一步的唤醒”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_next_wait_request_item_await_wake_frame":["保留“登记等待作者下一步的唤醒”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_functions_next_wait_request_item_await_wake_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"RegisterWake"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_next_wait_request_item.await_wake",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_next_wait_request_item_choose_next = defineNode({
  "display_name": "判断作者有新请求、已结束或仍需等待",
  "description": "检查作者函数的请求队列和运行状态。优先交出已提出的操作；函数结束且没有待确认请求时返回结束，否则继续等待唤醒。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"判断作者有新请求、已结束或仍需等待的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_next_wait_request_item_choose_next_frame","type":"era.tavern.frame.functions_next_wait_request_item.chosen","display_name":"判断作者有新请求、已结束或仍需等待的处理进度及结果"},{"key":"era_tavern_functions_next_wait_request_item_choose_next_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_next_wait_request_item_choose_next_frame","route":"era_tavern_functions_next_wait_request_item_choose_next_route"}},"input_semantics":{"era.tavern.call.frame":["保留“判断作者有新请求、已结束或仍需等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_next_wait_request_item_choose_next_frame":["保留“判断作者有新请求、已结束或仍需等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_functions_next_wait_request_item_choose_next_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"ChooseNext"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_next_wait_request_item.choose_next",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_next_wait_request_item_finish_call = defineNode({
  "display_name": "返回作者函数已结束的状态",
  "description": "当前作者函数已经结束且待确认操作均已处理时，交出结束结果及函数错误。主服务据此完成正文调用标记并安排释放运行资料。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_next_wait_request_item.chosen","cardinality":"exactly_one","display_name":"返回作者函数已结束的状态的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_next_wait_request_item_finish_call_frame","type":"era.tavern.frame.functions_next_wait_request_item.result","display_name":"返回作者函数已结束的状态的处理进度及结果"},{"key":"era_tavern_functions_next_wait_request_item_finish_call_done","type":"era.tavern.done.functions_next.wait_request","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_next_wait_request_item_finish_call_frame","done":"era_tavern_functions_next_wait_request_item_finish_call_done"}},"input_semantics":{"era.tavern.frame.functions_next_wait_request_item.chosen":["保留“返回作者函数已结束的状态”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_next_wait_request_item_finish_call_frame":["保留“返回作者函数已结束的状态”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_functions_next_wait_request_item_finish_call_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"FinishCall"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_next_wait_request_item.finish_call",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_next_wait_request_item_take_request = defineNode({
  "display_name": "取出作者提交的下一项操作",
  "description": "从当前函数请求队列取出最早一项，交出操作编号、种类和内容，并标记本轮等待已取得结果。主服务随后在消息位置执行并确认。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_next_wait_request_item.chosen","cardinality":"exactly_one","display_name":"取出作者提交的下一项操作的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_next_wait_request_item_take_request_frame","type":"era.tavern.frame.functions_next_wait_request_item.result","display_name":"取出作者提交的下一项操作的处理进度及结果"},{"key":"era_tavern_functions_next_wait_request_item_take_request_done","type":"era.tavern.done.functions_next.wait_request","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_next_wait_request_item_take_request_frame","done":"era_tavern_functions_next_wait_request_item_take_request_done"}},"input_semantics":{"era.tavern.frame.functions_next_wait_request_item.chosen":["保留“取出作者提交的下一项操作”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_next_wait_request_item_take_request_frame":["保留“取出作者提交的下一项操作”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_functions_next_wait_request_item_take_request_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"TakeRequest"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_next_wait_request_item.take_request",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_next_wait_request_item_wait_registered = defineNode({
  "display_name": "等待作者提交操作或结束通知",
  "description": "等待已经登记的作者唤醒信号，完成后移除这次等待。后续重新判断是取得请求、函数结束还是仍需继续等待。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_next.check_active","cardinality":"exactly_one","display_name":"等待作者提交操作或结束通知的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_next_wait_request_item_wait_registered_frame","type":"era.tavern.call.frame","display_name":"等待作者提交操作或结束通知的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_next_wait_request_item_wait_registered_frame"}},"input_semantics":{"era.tavern.frame.functions_next.check_active":["保留“等待作者提交操作或结束通知”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_next_wait_request_item_wait_registered_frame":["保留“等待作者提交操作或结束通知”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"suspend","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"WaitRegistered"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_next_wait_request_item.wait_registered",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_release_close_call = defineNode({
  "display_name": "使当前作者调用停止接受新请求",
  "description": "按调用身份移除作者运行登记并将它标为失效。后续依次结束未完成请求并解绑资料，使旧函数不能继续提交当前消息的操作。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.call.frame","cardinality":"exactly_one","display_name":"使当前作者调用停止接受新请求的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_release_close_call_frame","type":"era.tavern.frame.functions_release.close_call","display_name":"使当前作者调用停止接受新请求的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_release_close_call_frame"}},"input_semantics":{"era.tavern.call.frame":["保留“使当前作者调用停止接受新请求”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_release_close_call_frame":["保留“使当前作者调用停止接受新请求”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"CloseCall"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_release.close_call",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_release_return_release = defineNode({
  "display_name": "确认作者调用资料已释放",
  "description": "返回当前作者调用已经完成释放的确认。主服务据此继续处理正文或完成失败收尾。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_release.unbind_context","cardinality":"exactly_one","display_name":"确认作者调用资料已释放的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_release_return_release_frame","type":"era.tavern.call.frame","display_name":"确认作者调用资料已释放的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_release_return_release_frame"}},"input_semantics":{"era.tavern.frame.functions_release.unbind_context":["保留“确认作者调用资料已释放”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_release_return_release_frame":["保留“确认作者调用资料已释放”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"ReturnRelease"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_release.return_release",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_release_unbind_context = defineNode({
  "display_name": "解绑作者参数并唤醒等待中的调用",
  "description": "移除作者参数与运行资料的关联，释放本次取消监听并唤醒仍在等待的主服务。配合已完成的请求清理，让当前作者函数调用完整结束。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_release.reject_pending","cardinality":"exactly_one","display_name":"解绑作者参数并唤醒等待中的调用的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_release_unbind_context_frame","type":"era.tavern.frame.functions_release.unbind_context","display_name":"解绑作者参数并唤醒等待中的调用的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_release_unbind_context_frame"}},"input_semantics":{"era.tavern.frame.functions_release.reject_pending":["保留“解绑作者参数并唤醒等待中的调用”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_release_unbind_context_frame":["保留“解绑作者参数并唤醒等待中的调用”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"UnbindContext"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_release.unbind_context",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_release_reject_pending_item_choose_item = defineNode({
  "display_name": "检查还有哪些作者请求需要结束",
  "description": "查看当前已关闭函数是否仍有等待确认的操作。还有时进入逐项拒绝，全部结束后进入解绑，避免作者一直等待无法完成的请求。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_release.close_call","cardinality":"exactly_one","display_name":"检查还有哪些作者请求需要结束的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_release_reject_pending_item_choose_item_frame","type":"era.tavern.frame.functions_release.close_call","display_name":"检查还有哪些作者请求需要结束的处理进度及结果"},{"key":"era_tavern_functions_release_reject_pending_item_choose_item_route","type":"era.tavern.route","display_name":"按当前事实选出的处理方向"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_release_reject_pending_item_choose_item_frame","route":"era_tavern_functions_release_reject_pending_item_choose_item_route"}},"input_semantics":{"era.tavern.frame.functions_release.close_call":["保留“检查还有哪些作者请求需要结束”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_release_reject_pending_item_choose_item_frame":["保留“检查还有哪些作者请求需要结束”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_functions_release_reject_pending_item_choose_item_route":["这是根据本次实际状态选择的处理方向，后续只执行对应的一条路径。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"ChoosePending"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_release_reject_pending_item.choose_item",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_release_reject_pending_item_empty = defineNode({
  "display_name": "确认没有剩余作者请求需要结束",
  "description": "当前作者调用的待确认列表已经为空时，标记本轮遍历结束。后续解除参数关联与取消监听，完成作者资料释放。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_release.close_call","cardinality":"exactly_one","display_name":"确认没有剩余作者请求需要结束的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_release_reject_pending_item_empty_frame","type":"era.tavern.frame.functions_release.close_call","display_name":"确认没有剩余作者请求需要结束的处理进度及结果"},{"key":"era_tavern_functions_release_reject_pending_item_empty_done","type":"era.tavern.done.functions_release.reject_pending","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_release_reject_pending_item_empty_frame","done":"era_tavern_functions_release_reject_pending_item_empty_done"}},"input_semantics":{"era.tavern.frame.functions_release.close_call":["保留“确认没有剩余作者请求需要结束”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_release_reject_pending_item_empty_frame":["保留“确认没有剩余作者请求需要结束”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_functions_release_reject_pending_item_empty_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"EmptyPending"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_release_reject_pending_item.empty",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_release_reject_pending_item_one_item = defineNode({
  "display_name": "结束一项尚未确认的作者请求",
  "description": "取出当前函数一项未决请求，以调用已失效的原因结束它。外层重复本步骤直到清空，让所有等待该函数提交的调用都能结束。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_release.close_call","cardinality":"exactly_one","display_name":"结束一项尚未确认的作者请求的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_release_reject_pending_item_one_item_frame","type":"era.tavern.frame.functions_release.close_call","display_name":"结束一项尚未确认的作者请求的处理进度及结果"},{"key":"era_tavern_functions_release_reject_pending_item_one_item_done","type":"era.tavern.done.functions_release.reject_pending","display_name":"本轮遍历或职责处理是否已经结束"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_release_reject_pending_item_one_item_frame","done":"era_tavern_functions_release_reject_pending_item_one_item_done"}},"input_semantics":{"era.tavern.frame.functions_release.close_call":["保留“结束一项尚未确认的作者请求”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_release_reject_pending_item_one_item_frame":["保留“结束一项尚未确认的作者请求”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"],"era_tavern_functions_release_reject_pending_item_one_item_done":["表示当前清单或长期职责是否已达到结束条件，外层据此继续下一项或退出。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"RejectOne"}}],
  "rulesets": ["vibeflow.data_store"],
  "presentation": {"shape":"rect"},
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_release_reject_pending_item.one_item",
  "node_type": "vibeflow.node"
});

export const era_tavern_functions_next_start_wait = defineNode({
  "display_name": "发起对作者下一请求或结束的等待",
  "description": "为当前作者函数登记一次可取消的等待，交给后续流程检查请求队列和结束状态。主服务据此等待函数提出变量操作或真正运行结束。",
  "version": "0.1.0",
  "flow_kind": "data_store",
  "contract": {"requires":[{"type":"era.tavern.frame.functions_next_wait_request_item.final","cardinality":"exactly_one","display_name":"发起对作者下一请求或结束的等待的请求和已有进度"}],"provides":[{"key":"era_tavern_functions_next_start_wait_frame","type":"era.tavern.frame.functions_next.start_wait","display_name":"发起对作者下一请求或结束的等待的处理进度及结果"}],"params_schema":{"outputKeys":{"type":"object"}},"params_defaults":{"outputKeys":{"frame":"era_tavern_functions_next_start_wait_frame"}},"input_semantics":{"era.tavern.frame.functions_next_wait_request_item.final":["保留“发起对作者下一请求或结束的等待”对应的实例、请求及已经形成的进度，供本步骤处理并延续同一次请求。"]},"output_semantics":{"era_tavern_functions_next_start_wait_frame":["保留“发起对作者下一请求或结束的等待”对应的实例、请求及已经形成的进度，交给后续处理或结果返回。"]}},
  "implementations": [{"language":"typescript","targets":["browser","node"],"completion":"immediate","source":{"kind":"file","ref":"nodes/functions/channel.ts","export":"StartNext"}}],
  "rulesets": ["vibeflow.data_store"],
  "base_libs": ["era.tavern.frames","era.tavern.message_facts","era.tavern.resources","era.tavern.sidecar_facts"],
  "id": "era.tavern.functions_next.start_wait",
  "node_type": "vibeflow.node"
});
